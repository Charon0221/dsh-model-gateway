import { EFFORTS, type Effort, type GatewayModel, type ModelModality, type NativeSearchMode } from './shared.js';

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
  nativeSearch?: NativeSearchMode;
}

// Values are pinned from the vendors' public model documentation. Gateway
// capabilities remain user-editable because an upstream proxy may expose less.
export const OFFICIAL_MODEL_CATALOG: readonly OfficialModelDefaults[] = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat', providerFamily: 'deepseek', contextWindow: 131072, maxTokens: 8192, inputModalities: ['text'], reasoningEfforts: [...EFFORTS], defaultReasoningEffort: 'high', supportsTools: true, defaultTemperature: 1 },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', providerFamily: 'deepseek', contextWindow: 131072, maxTokens: 65536, inputModalities: ['text'], reasoningEfforts: ['low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true },
  { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', providerFamily: 'deepseek', contextWindow: 262144, maxTokens: 32768, inputModalities: ['text'], reasoningEfforts: [...EFFORTS], defaultReasoningEffort: 'high', supportsTools: true },
  { id: 'gpt-4.1', name: 'GPT-4.1', providerFamily: 'openai', contextWindow: 1047576, maxTokens: 32768, inputModalities: ['text', 'image'], reasoningEfforts: ['off'], defaultReasoningEffort: 'off', supportsTools: true, defaultTemperature: 1, nativeSearch: 'openai-responses' },
  { id: 'gpt-4o', name: 'GPT-4o', providerFamily: 'openai', contextWindow: 128000, maxTokens: 16384, inputModalities: ['text', 'image'], reasoningEfforts: ['off'], defaultReasoningEffort: 'off', supportsTools: true, defaultTemperature: 1, nativeSearch: 'openai-responses' },
  { id: 'o3', name: 'o3', providerFamily: 'openai', contextWindow: 200000, maxTokens: 100000, inputModalities: ['text', 'image'], reasoningEfforts: ['low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'openai-responses' },
  { id: 'o4-mini', name: 'o4-mini', providerFamily: 'openai', contextWindow: 200000, maxTokens: 100000, inputModalities: ['text', 'image'], reasoningEfforts: ['low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'openai-responses' },
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', providerFamily: 'anthropic', contextWindow: 200000, maxTokens: 64000, inputModalities: ['text', 'image'], reasoningEfforts: ['off', 'low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'anthropic-messages' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', providerFamily: 'anthropic', contextWindow: 200000, maxTokens: 64000, inputModalities: ['text', 'image'], reasoningEfforts: ['off', 'low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'anthropic-messages' },
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', providerFamily: 'anthropic', contextWindow: 200000, maxTokens: 32000, inputModalities: ['text', 'image'], reasoningEfforts: ['off', 'low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'anthropic-messages' },
  { id: 'grok-3', name: 'Grok 3', providerFamily: 'xai', contextWindow: 131072, maxTokens: 32768, inputModalities: ['text'], reasoningEfforts: ['off'], defaultReasoningEffort: 'off', supportsTools: true, defaultTemperature: 1, nativeSearch: 'openai-chat' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', providerFamily: 'xai', contextWindow: 131072, maxTokens: 32768, inputModalities: ['text'], reasoningEfforts: ['low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true },
  { id: 'grok-4', name: 'Grok 4', providerFamily: 'xai', contextWindow: 256000, maxTokens: 32768, inputModalities: ['text', 'image'], reasoningEfforts: ['low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'openai-chat' },
];

const byId = new Map(OFFICIAL_MODEL_CATALOG.map(model => [model.id, model]));

export function officialModelDefaults(id: string): OfficialModelDefaults | undefined {
  return byId.get(id.trim());
}

export function enrichModel(model: Partial<GatewayModel> & Pick<GatewayModel, 'id'>): GatewayModel {
  const defaults = officialModelDefaults(model.id);
  const explicitInput = model.inputModalities?.length ? model.inputModalities : undefined;
  const explicitEfforts = model.reasoningEfforts?.length ? model.reasoningEfforts : undefined;
  return {
    ...(defaults ?? {}),
    ...model,
    id: model.id,
    name: model.name ?? defaults?.name,
    contextWindow: model.contextWindow ?? defaults?.contextWindow,
    maxTokens: model.maxTokens ?? defaults?.maxTokens,
    inputModalities: explicitInput ?? defaults?.inputModalities ?? ['text'],
    reasoningEfforts: explicitEfforts ?? defaults?.reasoningEfforts ?? [...EFFORTS],
    defaultReasoningEffort: model.defaultReasoningEffort ?? defaults?.defaultReasoningEffort ?? 'high',
    supportsTools: model.supportsTools ?? defaults?.supportsTools ?? true,
    defaultTemperature: model.defaultTemperature ?? defaults?.defaultTemperature,
    nativeSearch: model.nativeSearch ?? defaults?.nativeSearch ?? 'none',
    supportsWebSearch: model.supportsWebSearch ?? true,
  };
}
