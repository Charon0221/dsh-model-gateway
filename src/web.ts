import { LlmError } from '@deepseek-ai/dsh-llm';
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
import type { ResolvedProfile } from './config.js';
import { errorCode, redactDiagnostic, requestHeaders } from './http.js';

export const MODEL_GATEWAY_WEB_PROVIDER = 'model-gateway-web';

function endpoint(profile: ResolvedProfile, protocol: string): string {
  return `${profile.baseURL}${protocol === 'responses' ? '/responses' : protocol === 'anthropic-messages' ? '/messages' : '/chat/completions'}`;
}

function sourcesFrom(value: any): WebSearchResult['sources'] {
  const output = Array.isArray(value?.output) ? value.output : [];
  const annotations = output.flatMap((item: any) => Array.isArray(item?.content) ? item.content.flatMap((part: any) => part?.annotations ?? []) : item?.annotations ?? []);
  const blocks = Array.isArray(value?.content) ? value.content : [];
  const resultItems = blocks.flatMap((block: any) => block?.type === 'web_search_tool_result' && Array.isArray(block.content) ? block.content : []).filter((item: any) => item?.type === 'web_search_result');
  const chatAnnotations = value?.choices?.flatMap((choice: any) => choice?.message?.annotations ?? []) ?? [];
  const all = [...resultItems, ...annotations, ...chatAnnotations];
  const seen = new Set<string>();
  return all.flatMap((item: any) => {
    const url = String(item?.url ?? item?.url_citation?.url ?? '');
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const title = item?.title ?? item?.url_citation?.title;
    return [{ url, ...(typeof title === 'string' && title ? { title } : {}), ...(typeof item?.snippet === 'string' && item.snippet ? { snippet: item.snippet } : {}) }];
  });
}

function nativeBody(profile: ResolvedProfile, model: string, query: string): Record<string, unknown> {
  const configured = profile.models.find(entry => entry.id === model);
  const mode = configured?.nativeSearch && configured.nativeSearch !== 'none'
    ? configured.nativeSearch
    : profile.protocol === 'responses' ? 'openai-responses' : profile.protocol === 'anthropic-messages' ? 'anthropic-messages' : 'openai-chat';
  const maxUses = configured?.nativeSearchMaxUses ?? profile.webSearch.maxUses;
  if (mode === 'openai-responses') return {
    model, input: [{ role: 'user', content: [{ type: 'input_text', text: `Perform a web search for the query: ${query}` }] }], stream: false,
    tools: [{ type: String(configured?.nativeSearchConfig?.type ?? 'web_search_preview'), ...(configured?.nativeSearchConfig ?? {}), ...(maxUses ? { max_uses: maxUses } : {}) }],
  };
  if (mode === 'anthropic-messages') return {
    model, max_tokens: configured?.maxTokens ?? profile.maxTokens, messages: [{ role: 'user', content: [{ type: 'text', text: `Perform a web search for the query: ${query}` }] }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses, ...(configured?.nativeSearchConfig ?? {}) }],
  };
  return { model, messages: [{ role: 'user', content: `Perform a web search for the query: ${query}` }], web_search_options: { ...(configured?.nativeSearchConfig ?? {}), ...(maxUses ? { max_uses: maxUses } : {}) } };
}

export class GatewayWebSearchProvider implements WebSearchProvider {
  readonly id = MODEL_GATEWAY_WEB_PROVIDER;
  constructor(private readonly profiles: () => ReadonlyMap<string, ResolvedProfile>, private readonly resolveApiKey: (profile: ResolvedProfile) => Promise<string>, private readonly currentProvider: () => string | undefined, private readonly fetchImpl: typeof fetch = fetch) {}
  available(): boolean {
    for (const profile of this.profiles().values()) if (profile.webSearch.enabled && profile.models.length) return true;
    return false;
  }
  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const profiles = this.profiles();
    const route = this.currentProvider();
    const profile = (route ? profiles.get(route) : undefined) ?? profiles.values().next().value;
    if (!profile || !profile.webSearch.enabled) throw new LlmError('没有可用的模型网关网页搜索配置', 'WEB_PROVIDER_UNAVAILABLE');
    const model = profile.webSearch.model ?? profile.models.find(entry => entry.nativeSearch && entry.nativeSearch !== 'none')?.id ?? profile.models[0].id;
    const key = await this.resolveApiKey(profile);
    const native = profile.models.find(entry => entry.id === model)?.nativeSearch;
    if ((!native || native === 'none') && !profile.webSearch.allowGenericFallback) throw new LlmError('当前模型未配置原生搜索，且网关已关闭通用搜索回退', 'WEB_PROVIDER_UNAVAILABLE');
    const protocol = native === 'anthropic-messages' ? 'anthropic-messages' : native === 'openai-responses' ? 'responses' : native === 'openai-chat' ? 'chat-completions' : profile.protocol ?? 'chat-completions';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), profile.webSearch.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetchImpl(endpoint(profile, protocol), { method: 'POST', redirect: 'error', headers: requestHeaders(key, profile.headers, undefined, protocol as any), body: JSON.stringify(nativeBody(profile, model, request.query)), signal: controller.signal });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let detail = '';
        try { detail = JSON.parse(text)?.error?.message ?? JSON.parse(text)?.message ?? ''; } catch { /* keep status only */ }
        throw new LlmError(`模型网关搜索 HTTP ${response.status}${detail ? `: ${redactDiagnostic(String(detail), [key])}` : ''}`, errorCode(response.status, String(detail)));
      }
      const sources = sourcesFrom(await response.json());
      if (!sources.length) throw new LlmError('原生搜索响应不包含可用来源', 'NATIVE_SEARCH_RESPONSE_INVALID');
      return { sources, truncated: false };
    } catch (error) {
      if (signal?.aborted) throw new LlmError('网页搜索已取消', 'WEB_ABORTED');
      if (controller.signal.aborted) throw new LlmError(`网页搜索超时（${profile.webSearch.timeoutMs}ms）`, 'TIMEOUT');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
}
