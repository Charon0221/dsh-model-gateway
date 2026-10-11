/** Shared JSON-only configuration vocabulary; safe to import in the browser. */
export const NS = 'llm-deepseek-gateway';
export const EFFORTS = ['off', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = typeof EFFORTS[number];
export const PROTOCOLS = ['chat-completions', 'responses', 'anthropic-messages'] as const;
export type GatewayProtocol = typeof PROTOCOLS[number];
export const NATIVE_SEARCH_MODES = ['none', 'openai-chat', 'openai-responses', 'anthropic-messages'] as const;
export type NativeSearchMode = typeof NATIVE_SEARCH_MODES[number];
export type ModelModality = 'text' | 'image';
export const ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const SENJIX_PRESET = {
  route: 'senjix', displayName: '深极云算', baseURL: 'https://senjix.cloud/v1',
  apiKeyEnv: 'SENJIX_API_KEY',
  // The documented Flash model accepts text and image input. Keep the preset
  // free of a capability override so the catalog remains the source of truth.
  models: [{ id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash' }],
};
export function keyRefFor(route: string): string {
  return `${route.toUpperCase().replace(/-/g, '_')}_API_KEY`;
}
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
