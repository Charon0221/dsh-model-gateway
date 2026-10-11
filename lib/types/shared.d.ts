/** Shared JSON-only configuration vocabulary; safe to import in the browser. */
export declare const NS = "llm-deepseek-gateway";
export declare const EFFORTS: readonly ["off", "low", "high", "max"];
export type Effort = typeof EFFORTS[number];
export declare const PROTOCOLS: readonly ["chat-completions", "responses", "anthropic-messages"];
export type GatewayProtocol = typeof PROTOCOLS[number];
export declare const NATIVE_SEARCH_MODES: readonly ["none", "openai-chat", "openai-responses", "anthropic-messages"];
export type NativeSearchMode = typeof NATIVE_SEARCH_MODES[number];
export type ModelModality = 'text' | 'image';
export declare const ROUTE_PATTERN: RegExp;
export declare const SENJIX_PRESET: {
    route: string;
    displayName: string;
    baseURL: string;
    apiKeyEnv: string;
    models: {
        id: string;
        name: string;
        inputModalities: ModelModality[];
    }[];
};
export declare function keyRefFor(route: string): string;
export interface GatewayModel {
    id: string;
    name?: string;
    description?: string;
    contextWindow?: number;
    maxTokens?: number;
    inputModalities?: ModelModality[];
    providerFamily?: 'deepseek' | 'openai' | 'anthropic' | 'xai';
    reasoningEfforts?: Effort[];
    defaultReasoningEffort?: Effort;
    supportsTools?: boolean;
    defaultTemperature?: number;
    nativeSearch?: NativeSearchMode;
    nativeSearchMaxUses?: number;
    nativeSearchConfig?: Record<string, string | number | boolean>;
    supportsWebSearch?: boolean;
    imagePixelBudget?: number | 'low';
    imageMaxBytes?: number;
}
export interface GatewayProfile {
    displayName?: string;
    baseURL: string;
    protocol?: GatewayProtocol;
    apiKeyEnv?: string;
    headers?: Record<string, string>;
    models: GatewayModel[];
    reasoningEffort?: Effort;
    defaultContextWindow?: number;
    maxTokens?: number;
    streamIdleTimeoutMs?: number;
    maxInlineRequestImageBytes?: number;
    maxImagesPerRequest?: number;
    retryPolicy?: import('@deepseek-ai/dsh-llm').RetryPolicyConfig;
    webSearch?: {
        enabled?: boolean;
        allowGenericFallback?: boolean;
        maxUses?: number;
        timeoutMs?: number;
        model?: string;
    };
}
