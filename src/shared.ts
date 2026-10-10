/** Shared JSON-only configuration vocabulary; safe to import in the browser. */
export const NS = 'llm-deepseek-gateway';
export const EFFORTS = ['off', 'low', 'high', 'max'] as const;
export type Effort = typeof EFFORTS[number];
export const ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const SENJIX_PRESET = {
  route: 'senjix', displayName: '深极云算', baseURL: 'https://senjix.cloud/v1',
  apiKeyEnv: 'SENJIX_API_KEY',
  models: [{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', inputModalities: ['text'] as ('text' | 'image')[] }],
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
  inputModalities?: ('text' | 'image')[];
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
