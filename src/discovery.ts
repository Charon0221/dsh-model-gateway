import { LlmError, assertUsableApiKey, type LlmModelDiscoveryRequest, type LlmDiscoveredModel } from '@deepseek-ai/dsh-llm';
import { apiBaseURL, type ResolvedProfile } from './config.js';
import { enrichModel, officialModelDefaults } from './catalog.js';
import { cancellable, httpFailure, idleControl, requestHeaders } from './http.js';

export async function discoverModels(
  request: LlmModelDiscoveryRequest, profiles: ReadonlyMap<string, ResolvedProfile>,
  resolveKey: (p: ResolvedProfile) => Promise<string>, signal?: AbortSignal,
): Promise<LlmDiscoveredModel[]> {
  const p = request.provider ? profiles.get(request.provider) : undefined;
  const base = request.baseURL ?? p?.baseURL;
  if (!base) throw new LlmError('请填写 Base URL', 'INVALID_REQUEST');
  const idle = idleControl(signal, Math.min(p?.streamIdleTimeoutMs ?? 30000, 30000));
  try {
    const key = request.apiKey !== undefined ? assertUsableApiKey(request.apiKey, 'llm-deepseek-gateway', 'draft') : p ? await cancellable(resolveKey(p), idle.signal) : undefined;
    if (!key) throw new LlmError('获取模型需要 API Key；也可以手工填写模型', 'MISSING_CREDENTIAL');
    const response = await fetch(`${apiBaseURL(base)}/models`, { headers: { ...requestHeaders(key, p?.headers), accept: 'application/json' }, signal: idle.signal, redirect: 'error' });
    if (!response.ok) throw await httpFailure(response, [key, ...Object.values(p?.headers ?? {})]);
    const value = await response.json();
    const list = Array.isArray(value.data) ? value.data : Array.isArray(value.models) ? value.models : undefined;
    if (!list) throw new LlmError('模型列表缺少 data/models 数组；请手工填写模型', 'MALFORMED_RESPONSE');
    const seen = new Set<string>();
    const positive = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : undefined;
    return list.flatMap((entry: Record<string, unknown>) => {
      if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || seen.has(entry.id)) return [];
      seen.add(entry.id);
      const official = officialModelDefaults(entry.id);
      const enriched = enrichModel({ id: entry.id,
        ...(official ? {} : { name: typeof entry.name === 'string' ? entry.name : undefined, contextWindow: positive(entry.context_window ?? entry.contextWindow), maxTokens: positive(entry.max_tokens ?? entry.maxTokens) }) });
      if (!official) delete enriched.inputModalities;
      return [enriched];
    });
  } catch (error) { throw idle.classify(error); }
  finally { idle.dispose(); }
}
