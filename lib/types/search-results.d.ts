import type { WebSearchResult } from '@deepseek-ai/dsh-web';
/** Shared by streamed native search and the optional standalone search provider. */
export declare class SearchSources {
    private readonly entries;
    add(value: unknown): void;
    values(): WebSearchResult['sources'];
    markdown(): string;
}
