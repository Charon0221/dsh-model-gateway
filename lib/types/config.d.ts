import z from '@deepseek-ai/schemastery';
import { type CredentialRef } from '@deepseek-ai/dsh-credentials';
import { type ResolvedRetryPolicy } from '@deepseek-ai/dsh-llm';
import { type Effort, type GatewayModel, type GatewayProfile } from './shared.js';
export interface Config {
    providers?: Record<string, GatewayProfile>;
}
export declare const ModelSchema: z<GatewayModel>;
export declare const ProfileSchema: z<GatewayProfile>;
export declare const Config: z<Config>;
export interface ResolvedProfile extends Omit<GatewayProfile, 'apiKeyEnv' | 'retryPolicy'> {
    route: string;
    displayName: string;
    apiKeyEnv: CredentialRef;
    reasoningEffort: Effort;
    defaultContextWindow: number;
    maxTokens: number;
    streamIdleTimeoutMs: number;
    maxInlineRequestImageBytes: number;
    maxImagesPerRequest: number;
    retryPolicy: ResolvedRetryPolicy;
}
export declare function apiBaseURL(input: string): string;
export declare function resolveProfiles(config: Config): ReadonlyMap<string, ResolvedProfile>;
