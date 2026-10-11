/** Shared JSON-only configuration vocabulary; safe to import in the browser. */
export declare const NS = "llm-deepseek-gateway";
export declare const EFFORTS: readonly ["off", "low", "high", "max"];
export type Effort = typeof EFFORTS[number];
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
    imagePixelBudget?: number | 'low';
    imageMaxBytes?: number;
}
export interface GatewayProfile {
    displayName?: string;
    baseURL: string;
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
}
