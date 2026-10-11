import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
import type { ResolvedProfile } from './config.js';
export declare const MODEL_GATEWAY_WEB_PROVIDER = "model-gateway-web";
export declare class GatewayWebSearchProvider implements WebSearchProvider {
    private readonly profiles;
    private readonly resolveApiKey;
    private readonly currentProvider;
    private readonly fetchImpl;
    readonly id = "model-gateway-web";
    constructor(profiles: () => ReadonlyMap<string, ResolvedProfile>, resolveApiKey: (profile: ResolvedProfile) => Promise<string>, currentProvider: () => string | undefined, fetchImpl?: typeof fetch);
    available(): boolean;
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
