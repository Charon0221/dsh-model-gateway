import {
  LlmAdapter, LlmError, ReasoningEffortId,
  type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk,
} from '@deepseek-ai/dsh-llm';
import { EFFORTS, type Effort } from './shared.js';
import type { ResolvedProfile } from './config.js';
import { serializeRequest, type SerializationServices } from './serialize.js';
import { cancellable, httpFailure, idleControl, requestHeaders } from './http.js';
import { ssePayloads, translate } from './stream.js';

export interface AdapterServices extends SerializationServices {
  profiles: () => ReadonlyMap<string, ResolvedProfile>;
  resolveApiKey: (profile: ResolvedProfile) => Promise<string>;
  serializationServices?: () => SerializationServices;
  fetch?: typeof fetch;
}
export class GatewayAdapter extends LlmAdapter {
  constructor(private readonly services: AdapterServices) { super(); }
  private profile(route: string) {
    const p = this.services.profiles().get(route);
    if (!p) throw new LlmError('该网关未配置', 'NO_ADAPTER');
    return p;
  }
  providerInfo(provider: string) { return { id: provider, name: this.profile(provider).displayName }; }
  providerRetryPolicy(provider: string) { return this.profile(provider).retryPolicy; }
  async listModels(provider: string) {
    return this.profile(provider).models.map(m => ({ provider, id: m.id, name: m.name ?? m.id, description: m.description, inputModalities: m.inputModalities ?? ['text' as const] }));
  }
  private modelInfo(p: ResolvedProfile, model: string): LlmResolvedModelInfo {
    const m = p.models.find(entry => entry.id === model);
    return {
      provider: p.route, id: model, name: m?.name ?? model, description: m?.description,
      inputModalities: m?.inputModalities ?? ['text'],
      context: { contextWindow: m?.contextWindow ?? p.defaultContextWindow },
      defaultMaxTokens: m?.maxTokens ?? p.maxTokens,
      reasoning: {
        efforts: (m?.reasoningEfforts ?? EFFORTS).map(id => ({ id: ReasoningEffortId(id), name: ({ off: '关闭', low: '低', high: '高', max: '最高' })[id], description: '发送兼容网关推理参数，实际效果由上游决定' })),
        defaultEffort: ReasoningEffortId(m?.defaultReasoningEffort ?? p.reasoningEffort),
      },
    };
  }
  async resolveModel(provider: string, model: string, signal?: AbortSignal) {
    signal?.throwIfAborted(); return this.modelInfo(this.profile(provider), model);
  }
  async prepareCall(provider: string, model: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const profile = this.profile(provider);
    return { model: this.modelInfo(profile, model), stream: (options: GenerateOptions) => this.streamWithProfile(options, profile) };
  }
  stream(options: GenerateOptions): AsyncIterable<StreamChunk> { return this.streamWithProfile(options, this.profile(options.provider)); }
  private async *streamWithProfile(options: GenerateOptions, profile: ResolvedProfile): AsyncGenerator<StreamChunk> {
    const idle = idleControl(options.signal, profile.streamIdleTimeoutMs);
    try {
      idle.signal.throwIfAborted();
      const key = await cancellable(this.services.resolveApiKey(profile), idle.signal);
      idle.signal.throwIfAborted();
      const services = this.services.serializationServices?.() ?? this.services;
      const body = await cancellable(serializeRequest({ ...options, signal: idle.signal }, profile, services), idle.signal);
      idle.pulse();
      const response = await (this.services.fetch ?? fetch)(`${profile.baseURL}/chat/completions`, {
        method: 'POST', headers: requestHeaders(key, profile.headers, options.sessionId),
        body: JSON.stringify(body), signal: idle.signal, redirect: 'error',
      });
      idle.pulse();
      if (!response.ok) throw await httpFailure(response, [key, ...Object.values(profile.headers ?? {})]);
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        await response.body?.cancel();
        throw new LlmError('网关未返回 SSE 响应', 'MALFORMED_RESPONSE');
      }
      yield* translate(ssePayloads(response.body, idle.pulse), [key, ...Object.values(profile.headers ?? {})]);
    } catch (error) { throw idle.classify(error); }
    finally { idle.dispose(); }
  }
}
