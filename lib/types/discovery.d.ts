import { type LlmModelDiscoveryRequest, type LlmDiscoveredModel } from '@deepseek-ai/dsh-llm';
import { type ResolvedProfile } from './config.js';
export declare function discoverModels(request: LlmModelDiscoveryRequest, profiles: ReadonlyMap<string, ResolvedProfile>, resolveKey: (p: ResolvedProfile) => Promise<string>, signal?: AbortSignal): Promise<LlmDiscoveredModel[]>;
