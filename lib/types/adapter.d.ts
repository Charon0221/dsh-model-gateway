import { LlmAdapter, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ResolvedProfile } from './config.js';
import { type SerializationServices } from './serialize.js';
export interface AdapterServices extends SerializationServices {
    profiles: () => ReadonlyMap<string, ResolvedProfile>;
    resolveApiKey: (profile: ResolvedProfile) => Promise<string>;
    serializationServices?: () => SerializationServices;
    fetch?: typeof fetch;
}
export declare class GatewayAdapter extends LlmAdapter {
    private readonly services;
    constructor(services: AdapterServices);
    private profile;
    providerInfo(provider: string): {
        id: string;
        name: string;
    };
    providerRetryPolicy(provider: string): import("@deepseek-ai/dsh-llm").ResolvedRetryPolicy;
    listModels(provider: string): Promise<{
        provider: string;
        id: string;
        name: string;
        description: string | undefined;
        inputModalities: ("text" | "image")[];
    }[]>;
    private modelInfo;
    resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<{
        model: LlmResolvedModelInfo;
        stream: (options: GenerateOptions) => AsyncGenerator<StreamChunk, any, any>;
    }>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private streamWithProfile;
}
