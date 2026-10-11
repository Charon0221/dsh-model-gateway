import { LlmError } from '@deepseek-ai/dsh-llm';
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
import type { ResolvedProfile } from './config.js';
import { errorCode, redactDiagnostic, requestHeaders } from './http.js';
import { SearchSources } from './search-results.js';
import { nativeModeForProtocol } from './catalog.js';

export const MODEL_GATEWAY_WEB_PROVIDER = 'model-gateway-web';

function endpoint(profile: ResolvedProfile, protocol: string): string {
  return `${profile.baseURL}${protocol === 'responses' ? '/responses' : protocol === 'anthropic-messages' ? '/messages' : '/chat/completions'}`;
}

function sourcesFrom(value: any): WebSearchResult['sources'] {
  const sources = new SearchSources();
  sources.add(value);
  return sources.values();
}

function nativeBody(profile: ResolvedProfile, model: string, query: string): Record<string, unknown> {
  const configured = profile.models.find(entry => entry.id === model);
  const mode = configured?.nativeSearch && configured.nativeSearch !== 'none'
    ? configured.nativeSearch
    : profile.protocol === 'responses' ? 'openai-responses' : profile.protocol === 'anthropic-messages' ? 'anthropic-messages' : 'openai-chat';
  const maxUses = configured?.nativeSearchMaxUses ?? profile.webSearch.maxUses;
  if (mode === 'openai-responses') return {
    model, input: [{ role: 'user', content: [{ type: 'input_text', text: `Perform a web search for the query: ${query}` }] }], stream: false,
    tools: [{ type: String(configured?.nativeSearchConfig?.type ?? 'web_search'), ...(configured?.nativeSearchConfig ?? {}) }],
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
    for (const profile of this.profiles().values()) if (profile.webSearch.enabled && profile.models.some(m => m.supportsWebSearch && nativeModeForProtocol(m.nativeSearch, profile.protocol ?? 'chat-completions') !== 'none')) return true;
    return false;
  }
  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    if (signal?.aborted) throw new LlmError('网页搜索已取消', 'WEB_ABORTED');
    const profiles = this.profiles();
    const route = this.currentProvider();
    const profile = (route ? profiles.get(route) : undefined) ?? profiles.values().next().value;
    if (!profile || !profile.webSearch.enabled) throw new LlmError('没有可用的模型网关网页搜索配置', 'WEB_PROVIDER_UNAVAILABLE');
    const model = profile.webSearch.model ?? profile.models.find(entry => entry.supportsWebSearch && entry.nativeSearch && entry.nativeSearch !== 'none')?.id;
    if (!model) throw new LlmError('网关桥接没有已启用原生搜索的模型', 'WEB_PROVIDER_UNAVAILABLE');
    const configured = profile.models.find(entry => entry.id === model);
    const native = configured?.nativeSearch;
    if (!native || native === 'none') throw new LlmError('当前模型未配置原生搜索，不会推测搜索能力或切换提供方', 'WEB_PROVIDER_UNAVAILABLE');
    const protocol = profile.protocol ?? 'chat-completions';
    if (nativeModeForProtocol(native, protocol) === 'none') throw new LlmError('桥接模型的原生搜索与网关协议不匹配，不会切换协议', 'NATIVE_SEARCH_PROTOCOL_MISMATCH');
    if (configured?.supportsWebSearch === false) throw new LlmError('桥接模型已关闭网页搜索', 'WEB_PROVIDER_UNAVAILABLE');
    const key = await this.resolveApiKey(profile);
    if (signal?.aborted) throw new LlmError('网页搜索已取消', 'WEB_ABORTED');
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
