import { LlmError } from '@deepseek-ai/dsh-llm';
import type { WebSearchResult } from '@deepseek-ai/dsh-web';

/** Shared by streamed native search and the optional standalone search provider. */
export class SearchSources {
  private readonly entries = new Map<string, WebSearchResult['sources'][number]>();
  add(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, any>;
    if (item.type === 'web_search_tool_result_error') throw new LlmError(`原生搜索失败：${String(item.error_code ?? 'unknown')}`, 'NATIVE_SEARCH_FAILED');
    const citation = item.url_citation ?? item;
    if (typeof citation.url === 'string') {
      try {
        const url = new URL(citation.url);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
        const previous = this.entries.get(citation.url);
        this.entries.set(citation.url, {
          url: citation.url,
          ...(previous ?? {}),
          ...(typeof citation.title === 'string' && citation.title ? { title: citation.title } : {}),
          ...(typeof citation.snippet === 'string' && citation.snippet ? { snippet: citation.snippet } : {}),
        });
      } catch { /* Ignore malformed source URLs. */ }
    }
    for (const key of ['output', 'content', 'annotations', 'citations', 'sources', 'results', 'choices']) {
      if (Array.isArray(item[key])) for (const child of item[key]) this.add(child);
    }
    for (const key of ['action', 'message', 'delta', 'content']) if (item[key] && !Array.isArray(item[key])) this.add(item[key]);
  }
  values(): WebSearchResult['sources'] { return [...this.entries.values()]; }
  markdown(): string {
    if (!this.entries.size) return '';
    return '\n\n搜索来源：\n' + this.values().map(source => {
      const title = (source.title ?? source.url).replace(/[\\\[\]\r\n]/g, ' ');
      const url = source.url.replace(/[<>\s]/g, char => encodeURIComponent(char));
      return `- [${title}](<${url}>)`;
    }).join('\n');
  }
}
