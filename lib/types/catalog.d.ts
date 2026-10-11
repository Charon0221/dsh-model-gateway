import { type Effort, type GatewayModel, type GatewayProtocol, type ModelModality, type NativeSearchMode } from './shared.js';
export type CapabilityStatus = 'supported' | 'unsupported' | 'unverified';
export interface OfficialModelDefaults {
    id: string;
    name: string;
    providerFamily: NonNullable<GatewayModel['providerFamily']>;
    contextWindow?: number;
    maxTokens?: number;
    inputModalities: ModelModality[];
    reasoningEfforts: Effort[];
    defaultReasoningEffort: Effort;
    supportsTools: boolean;
    defaultTemperature?: number;
    nativeSearch?: NativeSearchMode;
}
export interface ModelDocumentation {
    sources: readonly string[];
    checkedAt: string;
    image: CapabilityStatus;
    tools: CapabilityStatus;
    reasoning: CapabilityStatus;
    nativeSearch: CapabilityStatus;
    reasoningStyle: 'deepseek' | 'openai' | 'anthropic-budget' | 'anthropic-adaptive' | 'xai' | 'none';
    temperature: boolean;
    aliases?: readonly string[];
    toolsProtocols?: readonly GatewayProtocol[];
    reasoningProtocols?: readonly GatewayProtocol[];
    imageProtocols?: readonly GatewayProtocol[];
    stop?: boolean;
}
export declare const OFFICIAL_MODEL_CATALOG: readonly OfficialModelDefaults[];
export declare function officialModelDefaults(id: string, protocol?: GatewayProtocol): OfficialModelDefaults | undefined;
export declare function modelDocumentation(id: string): ModelDocumentation | undefined;
export declare function nativeModeForProtocol(mode: NativeSearchMode | undefined, protocol: GatewayProtocol): NativeSearchMode;
export declare function enrichModel(model: Partial<GatewayModel> & Pick<GatewayModel, 'id'>, protocol?: GatewayProtocol): GatewayModel;
export declare const CAPABILITY_FIELDS: readonly ["inputModalities", "providerFamily", "reasoningEfforts", "defaultReasoningEffort", "supportsTools", "defaultTemperature", "nativeSearch", "nativeSearchConfig", "nativeSearchMaxUses", "supportsWebSearch", "contextWindow", "maxTokens", "imagePixelBudget", "imageMaxBytes"];
export declare function restoreOfficialDefaults(model: GatewayModel, protocol: GatewayProtocol): GatewayModel;
