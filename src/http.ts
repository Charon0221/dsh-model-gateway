import { LlmError, ProviderRequestId, attributionHeaders, isContextWindowExceededError, isQuotaExceededError } from '@deepseek-ai/dsh-llm';

export function errorCode(status: number, detail: string): string {
  return status === 401 || status === 403 ? 'AUTH'
    : isQuotaExceededError(detail) || status === 402 ? 'QUOTA'
    : isContextWindowExceededError(detail) ? 'CONTEXT_WINDOW_EXCEEDED'
    : status === 429 ? 'RATE_LIMIT' : status === 408 || status === 504 ? 'TIMEOUT'
    : status >= 500 ? 'SERVER' : status === 400 || status === 422 ? 'INVALID_REQUEST' : `HTTP_${status}`;
}

export function requestHeaders(key: string, extra?: Record<string, string>, sessionId?: string): Record<string, string> {
  return { ...extra, authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'text/event-stream', ...attributionHeaders(), ...(sessionId ? { 'x-deepseek-harness-session-id': sessionId } : {}) };
}
export function redactDiagnostic(message: string, secrets: readonly string[]): string {
  let safe = message;
  for (const secret of secrets) if (secret) safe = safe.split(secret).join('[redacted]');
  return safe.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]').slice(0, 1000);
}
export async function httpFailure(response: Response, secrets: readonly string[] = []): Promise<LlmError> {
  // Bound provider diagnostics rather than accumulating arbitrary error bodies.
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let body = '';
  try {
    if (reader) while (body.length < 16384) {
      const { value, done } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
    }
  } finally { await reader?.cancel().catch(() => {}); reader?.releaseLock(); }
  let detail = '';
  try {
    const error = JSON.parse(body)?.error;
    if (typeof error?.message === 'string') detail = error.message;
    else if (typeof error === 'string') detail = error;
  } catch { /* HTML/proxy errors carry status only. */ }
  const status = response.status;
  const code = errorCode(status, detail);
  const after = response.headers.get('retry-after');
  const delay = after === null ? NaN : /^\d+(\.\d+)?$/.test(after) ? Number(after) * 1000 : Date.parse(after) - Date.now();
  const id = response.headers.get('x-request-id') ?? response.headers.get('request-id');
  return new LlmError(`网关 HTTP ${status}${detail ? ': ' + redactDiagnostic(detail, secrets) : ''}`, code, {
    status, ...(Number.isFinite(delay) && delay > 0 ? { providerRetryAfterMs: delay } : {}),
    ...(id && !secrets.some(s => s && id.includes(s)) ? { requestId: ProviderRequestId(id) } : {}),
  });
}

export async function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally { signal.removeEventListener('abort', abort); }
}

/** A watchdog spans connection setup, image reads, headers and SSE reads. */
export function idleControl(caller: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout>;
  const pulse = () => {
    clearTimeout(timer);
    if (!controller.signal.aborted) timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  };
  const abort = () => controller.abort();
  if (caller?.aborted) abort(); else caller?.addEventListener('abort', abort, { once: true });
  pulse();
  return {
    signal: controller.signal, pulse,
    classify(error: unknown): LlmError {
      if (caller?.aborted) return new LlmError('调用已取消', 'ABORTED');
      if (timedOut) return new LlmError(`网关空闲超时（${ms}ms）`, 'TIMEOUT');
      if (error instanceof LlmError) return error;
      return new LlmError('网关连接或流读取失败', 'TRANSPORT');
    },
    dispose() { clearTimeout(timer); caller?.removeEventListener('abort', abort); controller.abort(); },
  };
}
