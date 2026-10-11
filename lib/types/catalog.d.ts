import { type Effort, type GatewayModel, type ModelModality } from './shared.js';
export interface OfficialModelDefaults {
    id: string;
    name: string;
    providerFamily: 'deepseek' | 'openai' | 'anthropic' | 'xai';
    contextWindow: number;
    maxTokens: number;
    inputModalities: ModelModality[];
    reasoningEfforts: Effort[];
    defaultReasoningEffort: Effort;
    supportsTools: boolean;
    defaultTemperature?: number;
}
export declare const OFFICIAL_MODEL_CATALOG: readonly OfficialModelDefaults[];
export declare function officialModelDefaults(id: string): OfficialModelDefaults | undefined;
export declare function enrichModel(model: Partial<GatewayModel> & Pick<GatewayModel, 'id'>): GatewayModel;
