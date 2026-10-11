import { createParser } from 'eventsource-parser';
import { LlmError, ToolCallId, type ContentBlock, type FinishReason, type StreamChunk, type TokenUsage } from '@deepseek-ai/dsh-llm';
import { errorCode, redactDiagnostic } from './http.js';

/** Decode SSE across arbitrary byte/UTF-8 boundaries; never collect a whole response. */
export async function* ssePayloads(body: ReadableStream<Uint8Array>, activity: () => void): AsyncGenerator<string> {
  const queue: string[] = [];
  let failure: unknown;
  const parser = createParser({
    maxBufferSize: 8 * 1024 * 1024,
    onEvent: e => queue.push(e.data),
    onError: e => { if (e.type === 'max-buffer-size-exceeded') failure = new LlmError('SSE 事件超过 8 MiB', 'MALFORMED_RESPONSE'); },
  });
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      activity();
      parser.feed(decoder.decode(value, { stream: true }));
      if (failure) throw failure;
      while (queue.length) yield queue.shift()!;
    }
    parser.feed(decoder.decode());
    if (failure) throw failure;
    while (queue.length) yield queue.shift()!;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

type JsonObject = Record<string, unknown>;
function object(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }
const malformed = () => new LlmError('网关返回了不符合所选协议的流数据', 'MALFORMED_RESPONSE');
function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
export function mapUsage(raw: JsonObject): TokenUsage | undefined {
  if (!count(raw.prompt_tokens) || !count(raw.completion_tokens)) return undefined;
  const details = object(raw.prompt_tokens_details) ? raw.prompt_tokens_details : {};
  const output = object(raw.completion_tokens_details) ? raw.completion_tokens_details : {};
  const hit = raw.prompt_cache_hit_tokens ?? details.cached_tokens;
  const cache = count(hit) && hit <= raw.prompt_tokens ? hit : 0;
  const total = raw.prompt_tokens + raw.completion_tokens;
  return {
    inputTokens: raw.prompt_tokens - cache, outputTokens: raw.completion_tokens,
    ...(raw.total_tokens === undefined || raw.total_tokens === total ? { totalTokens: total } : {}),
    ...(cache ? { cacheReadTokens: cache } : {}),
    ...(count(output.reasoning_tokens) ? { reasoningTokens: output.reasoning_tokens } : {}),
  };
}
function finishReason(value: string): FinishReason {
  if (value === 'stop') return { kind: 'stop' };
  if (value === 'tool_calls') return { kind: 'tool-calls' };
  if (value === 'length') return { kind: 'max-tokens' };
  return { kind: 'error', failure: { code: value === 'content_filter' ? 'CONTENT_FILTER' : 'MALFORMED_RESPONSE', message: '网关以不支持的原因终止响应' } };
}
interface OpenBlock { index: number; kind: 'text' | 'reasoning' | 'tool-call'; text: string; id?: string; name?: string }

export async function* translate(payloads: AsyncIterable<string>, secrets: readonly string[] = []): AsyncGenerator<StreamChunk> {
  const blocks: OpenBlock[] = [];
  let text: OpenBlock | undefined;
  let reasoning: OpenBlock | undefined;
  const tools = new Map<number, OpenBlock>();
  let finish: FinishReason | undefined;
  let usage: TokenUsage | undefined;
  const open = (kind: OpenBlock['kind']) => { const b = { index: blocks.length, kind, text: '' }; blocks.push(b); return b; };
  const identity = (current: string | undefined, next: unknown) => {
    if (next === undefined || next === null || next === '') return current;
    if (typeof next !== 'string' || current !== undefined && current !== next) throw malformed();
    return next;
  };
  for await (const data of payloads) {
    if (data === '[DONE]') {
      if (!finish) throw new LlmError('SSE 结束前缺少 finish_reason', 'MALFORMED_RESPONSE');
      const ids = new Set<string>();
      // Validate every tool identity before sealing any block for execution.
      for (const b of tools.values()) {
        if (!b.id || !b.name || ids.has(b.id)) throw malformed();
        ids.add(b.id);
      }
      if (tools.size && finish.kind === 'stop') finish = { kind: 'tool-calls' };
      if (finish.kind === 'tool-calls' && !tools.size) throw malformed();
      for (const b of blocks) {
        const block: ContentBlock = b.kind === 'tool-call'
          ? { type: 'tool-call', id: ToolCallId(b.id!), name: b.name!, arguments: b.text }
          : { type: b.kind, text: b.text };
        yield { type: 'block-end', index: b.index, block };
      }
      if (usage) yield { type: 'usage', usage };
      yield { type: 'finish', reason: finish.kind === 'stop' && !blocks.length ? { kind: 'error', failure: { code: 'EMPTY_RESPONSE', message: '模型返回了空响应' } } : finish };
      return;
    }
    let chunk: unknown;
    try { chunk = JSON.parse(data); } catch { throw malformed(); }
    if (!object(chunk)) throw malformed();
    if (chunk.error) {
      const e = object(chunk.error) ? chunk.error : {};
      const detail = [e.message, e.type, e.code].filter(v => typeof v === 'string').join(' ');
      const code = /rate.?limit/i.test(detail) ? 'RATE_LIMIT' : errorCode(typeof e.status === 'number' ? e.status : 500, detail);
      throw new LlmError(`网关 SSE 错误${detail ? ': ' + redactDiagnostic(detail, secrets) : ''}`, code);
    }
    if (!Array.isArray(chunk.choices)) throw malformed();
    for (const raw of chunk.choices) {
      if (!object(raw) || raw.index !== undefined && raw.index !== 0) throw malformed();
      const delta = raw.delta;
      if (delta !== undefined && !object(delta)) throw malformed();
      if (object(delta)) {
        for (const key of ['reasoning_content', 'content'] as const) {
          const part = delta[key];
          if (part === undefined || part === null || part === '') continue;
          if (typeof part !== 'string' || finish) throw malformed();
          let b = key === 'content' ? text : reasoning;
          if (!b) {
            b = open(key === 'content' ? 'text' : 'reasoning');
            if (key === 'content') text = b; else reasoning = b;
            yield { type: 'block-start', index: b.index, blockType: b.kind };
          }
          b.text += part;
          yield { type: key === 'content' ? 'text-delta' : 'reasoning-delta', index: b.index, text: part };
        }
        if (delta.tool_calls !== undefined && delta.tool_calls !== null) {
          if (!Array.isArray(delta.tool_calls) || finish) throw malformed();
          for (const call of delta.tool_calls) {
            if (!object(call) || !count(call.index) || call.type !== undefined && call.type !== 'function') throw malformed();
            if (call.function !== undefined && call.function !== null && !object(call.function)) throw malformed();
            const fn = object(call.function) ? call.function : {};
            const args = fn.arguments ?? '';
            if (typeof args !== 'string') throw malformed();
            let b = tools.get(call.index);
            if (!b) { b = open('tool-call'); tools.set(call.index, b); yield { type: 'block-start', index: b.index, blockType: 'tool-call' }; }
            b.id = identity(b.id, call.id); b.name = identity(b.name, fn.name); b.text += args;
            yield { type: 'tool-call-delta', index: b.index, id: ToolCallId(b.id ?? ''), ...(b.name ? { name: b.name } : {}), argumentsDelta: args };
          }
        }
      }
      if (raw.finish_reason !== undefined && raw.finish_reason !== null) {
        if (typeof raw.finish_reason !== 'string' || finish) throw malformed();
        finish = finishReason(raw.finish_reason);
      }
    }
    if (object(chunk.usage)) usage = mapUsage(chunk.usage) ?? usage;
  }
  throw new LlmError('网关流在 [DONE] 前关闭', 'STREAM_CLOSED');
}

function usageFromResponses(raw: any): TokenUsage | undefined {
  if (!raw || !count(raw.input_tokens) || !count(raw.output_tokens)) return undefined;
  const total = raw.total_tokens;
  return { inputTokens: raw.input_tokens, outputTokens: raw.output_tokens, ...(count(total) ? { totalTokens: total } : {}) };
}

function usageFromAnthropic(raw: any, prior?: TokenUsage): TokenUsage | undefined {
  if (!raw || typeof raw !== 'object') return prior;
  const input = count(raw.input_tokens) ? raw.input_tokens : prior?.inputTokens;
  const output = count(raw.output_tokens) ? raw.output_tokens : prior?.outputTokens;
  if (input === undefined || output === undefined) return prior;
  return { inputTokens: input, outputTokens: output, totalTokens: input + output };
}

/** Translate OpenAI Responses SSE events into the dsh-neutral stream. */
export async function* translateResponses(payloads: AsyncIterable<string>, secrets: readonly string[] = []): AsyncGenerator<StreamChunk> {
  const blocks: OpenBlock[] = [];
  const tools = new Map<string, OpenBlock>();
  let text: OpenBlock | undefined;
  let reasoning: OpenBlock | undefined;
  let finish: FinishReason | undefined;
  let usage: TokenUsage | undefined;
  const open = (kind: OpenBlock['kind'], key?: string) => {
    const b: OpenBlock = { index: blocks.length, kind, text: '' };
    blocks.push(b);
    if (key) tools.set(key, b);
    return b;
  };
  const complete = async function* (): AsyncGenerator<StreamChunk> {
    if (!finish) finish = tools.size ? { kind: 'tool-calls' } : { kind: 'stop' };
    for (const b of blocks) yield { type: 'block-end', index: b.index, block: b.kind === 'tool-call' ? { type: 'tool-call', id: ToolCallId(b.id!), name: b.name!, arguments: b.text } : { type: b.kind, text: b.text } };
    if (usage) yield { type: 'usage', usage };
    yield { type: 'finish', reason: finish.kind === 'stop' && !blocks.length ? { kind: 'error', failure: { code: 'EMPTY_RESPONSE', message: '模型返回了空响应' } } : finish };
  };
  for await (const data of payloads) {
    if (data === '[DONE]') { yield* complete(); return; }
    let raw: unknown;
    try { raw = JSON.parse(data); } catch { throw malformed(); }
    if (!object(raw)) throw malformed();
    const event = raw as any;
    if (event.error) throw new LlmError(`Responses 网关错误${event.error.message ? ': ' + redactDiagnostic(String(event.error.message), secrets) : ''}`, errorCode(Number(event.error.status) || 500, String(event.error.message ?? '')));
    const type = event.type;
    if (typeof type !== 'string') throw malformed();
    if (type === 'response.output_item.added') {
      const item = event.item;
      if (object(item) && item.type === 'function_call') {
        const key = String(item.call_id ?? item.id ?? '');
        if (!key) throw malformed();
        const b = open('tool-call', key); b.id = String(item.call_id ?? key); b.name = typeof item.name === 'string' ? item.name : undefined;
        if (item.id && String(item.id) !== key) tools.set(String(item.id), b);
        yield { type: 'block-start', index: b.index, blockType: 'tool-call' };
        if (typeof item.arguments === 'string' && item.arguments) { b.text += item.arguments; yield { type: 'tool-call-delta', index: b.index, id: ToolCallId(key), ...(b.name ? { name: b.name } : {}), argumentsDelta: item.arguments }; }
      }
    } else if (type === 'response.output_text.delta') {
      if (typeof event.delta !== 'string') throw malformed();
      if (!text) { text = open('text'); yield { type: 'block-start', index: text.index, blockType: 'text' }; }
      text.text += event.delta; yield { type: 'text-delta', index: text.index, text: event.delta };
    } else if (type === 'response.reasoning_summary_text.delta' || type === 'response.reasoning_text.delta') {
      if (typeof event.delta !== 'string') throw malformed();
      if (!reasoning) { reasoning = open('reasoning'); yield { type: 'block-start', index: reasoning.index, blockType: 'reasoning' }; }
      reasoning.text += event.delta; yield { type: 'reasoning-delta', index: reasoning.index, text: event.delta };
    } else if (type === 'response.function_call_arguments.delta') {
      if (typeof event.delta !== 'string') throw malformed();
      const key = String(event.item_id ?? event.call_id ?? '');
      const b = tools.get(key);
      if (!b) throw malformed();
      b.text += event.delta; yield { type: 'tool-call-delta', index: b.index, id: ToolCallId(b.id!), ...(b.name ? { name: b.name } : {}), argumentsDelta: event.delta };
    } else if (type === 'response.completed') {
      usage = usageFromResponses(event.response?.usage) ?? usage;
      const status = event.response?.status;
      finish = tools.size ? { kind: 'tool-calls' } : status === 'incomplete' ? { kind: 'max-tokens' } : { kind: 'stop' };
      yield* complete(); return;
    } else if (type === 'response.incomplete') { finish = { kind: 'max-tokens' }; }
    else if (type === 'response.failed') throw new LlmError(`Responses 网关失败${event.response?.error?.message ? ': ' + redactDiagnostic(String(event.response.error.message), secrets) : ''}`, 'SERVER');
    if (event.response?.usage) usage = usageFromResponses(event.response.usage) ?? usage;
  }
  throw new LlmError('Responses 网关流在结束前关闭', 'STREAM_CLOSED');
}

/** Translate Anthropic Messages SSE events into the dsh-neutral stream. */
export async function* translateAnthropic(payloads: AsyncIterable<string>, secrets: readonly string[] = []): AsyncGenerator<StreamChunk> {
  const blocks: OpenBlock[] = [];
  const byIndex = new Map<number, OpenBlock>();
  let finish: FinishReason | undefined;
  let usage: TokenUsage | undefined;
  const complete = async function* (): AsyncGenerator<StreamChunk> {
    if (!finish) finish = blocks.some(b => b.kind === 'tool-call') ? { kind: 'tool-calls' } : { kind: 'stop' };
    for (const b of blocks) yield { type: 'block-end', index: b.index, block: b.kind === 'tool-call' ? { type: 'tool-call', id: ToolCallId(b.id!), name: b.name!, arguments: b.text } : { type: b.kind, text: b.text } };
    if (usage) yield { type: 'usage', usage };
    yield { type: 'finish', reason: finish.kind === 'stop' && !blocks.length ? { kind: 'error', failure: { code: 'EMPTY_RESPONSE', message: '模型返回了空响应' } } : finish };
  };
  for await (const data of payloads) {
    if (data === '[DONE]') { yield* complete(); return; }
    let raw: unknown;
    try { raw = JSON.parse(data); } catch { throw malformed(); }
    if (!object(raw)) throw malformed();
    const event = raw as any;
    if (event.type === 'error') throw new LlmError(`Anthropic 网关错误${event.error?.message ? ': ' + redactDiagnostic(String(event.error.message), secrets) : ''}`, 'SERVER');
    if (event.type === 'message_start') usage = usageFromAnthropic(event.message?.usage, usage);
    else if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (!object(block) || typeof event.index !== 'number') throw malformed();
      const kind = block.type === 'tool_use' ? 'tool-call' : block.type === 'thinking' ? 'reasoning' : block.type === 'text' ? 'text' : undefined;
      if (!kind) continue;
      const b = { index: blocks.length, kind, text: '', ...(kind === 'tool-call' ? { id: typeof block.id === 'string' ? block.id : undefined, name: typeof block.name === 'string' ? block.name : undefined } : {}) } as OpenBlock;
      blocks.push(b); byIndex.set(event.index, b);
      yield { type: 'block-start', index: b.index, blockType: b.kind };
    } else if (event.type === 'content_block_delta') {
      const b = byIndex.get(event.index); const delta = event.delta;
      if (!b || !object(delta)) throw malformed();
      if (delta.type === 'text_delta' || delta.type === 'thinking_delta') {
        const text = delta.type === 'thinking_delta' ? delta.thinking : delta.text;
        if (typeof text !== 'string') throw malformed(); b.text += text; yield { type: delta.type === 'text_delta' ? 'text-delta' : 'reasoning-delta', index: b.index, text };
      } else if (delta.type === 'input_json_delta') {
        if (typeof delta.partial_json !== 'string' || b.kind !== 'tool-call') throw malformed(); b.text += delta.partial_json; yield { type: 'tool-call-delta', index: b.index, id: ToolCallId(b.id!), ...(b.name ? { name: b.name } : {}), argumentsDelta: delta.partial_json };
      }
    } else if (event.type === 'message_delta') {
      usage = usageFromAnthropic(event.usage, usage);
      const reason = event.delta?.stop_reason;
      if (reason === 'tool_use') finish = { kind: 'tool-calls' }; else if (reason === 'max_tokens') finish = { kind: 'max-tokens' }; else if (reason === 'end_turn' || reason === 'stop_sequence') finish = { kind: 'stop' };
    } else if (event.type === 'message_stop') { yield* complete(); return; }
  }
  throw new LlmError('Anthropic 网关流在 message_stop 前关闭', 'STREAM_CLOSED');
}
