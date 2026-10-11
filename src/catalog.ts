import { type Effort, type GatewayModel, type GatewayProtocol, type ModelModality, type NativeSearchMode } from './shared.js';
export type CapabilityStatus = 'supported' | 'unsupported' | 'unverified';
export interface OfficialModelDefaults {
  id: string; name: string; providerFamily: NonNullable<GatewayModel['providerFamily']>;
  contextWindow?: number; maxTokens?: number; inputModalities: ModelModality[];
  reasoningEfforts: Effort[]; defaultReasoningEffort: Effort; supportsTools: boolean;
  defaultTemperature?: number; nativeSearch?: NativeSearchMode;
}
export interface ModelDocumentation {
  sources: readonly string[]; checkedAt: string;
  image: CapabilityStatus; tools: CapabilityStatus; reasoning: CapabilityStatus; nativeSearch: CapabilityStatus;
  reasoningStyle: 'deepseek' | 'openai' | 'anthropic-budget' | 'anthropic-adaptive' | 'xai' | 'none';
  temperature: boolean; aliases?: readonly string[];
  toolsProtocols?: readonly GatewayProtocol[];
  reasoningProtocols?: readonly GatewayProtocol[];
  imageProtocols?: readonly GatewayProtocol[];
  stop?: boolean;
}
const deepseekSources = ['https://api-docs.deepseek.com/quick_start/pricing/', 'https://api-docs.deepseek.com/guides/vision/', 'https://api-docs.deepseek.com/guides/thinking_mode/', 'https://api-docs.deepseek.com/guides/responses_api/'];
const entries: { defaults: OfficialModelDefaults; documentation: ModelDocumentation }[] = [];
function add(defaults: OfficialModelDefaults, sources: string[], style: ModelDocumentation['reasoningStyle'], aliases: string[] = []) {
  entries.push({ defaults, documentation: { sources, checkedAt: '2026-10-11', image: defaults.inputModalities.includes('image') ? 'supported' : 'unsupported', tools: defaults.supportsTools ? 'supported' : 'unsupported', reasoning: defaults.reasoningEfforts.some(e => e !== 'off') ? 'supported' : 'unsupported', nativeSearch: defaults.nativeSearch && defaults.nativeSearch !== 'none' ? 'supported' : 'unsupported', reasoningStyle: style, temperature: defaults.defaultTemperature !== undefined || style === 'deepseek' || style === 'anthropic-budget', aliases } });
  const protocols: GatewayProtocol[] = defaults.providerFamily === 'deepseek' ? ['chat-completions', 'responses', 'anthropic-messages'] : defaults.providerFamily === 'anthropic' ? ['anthropic-messages'] : ['chat-completions', 'responses'];
  Object.assign(entries.at(-1)!.documentation, { toolsProtocols: protocols, reasoningProtocols: protocols, imageProtocols: protocols, stop: style === 'none' || style.startsWith('anthropic') || style === 'deepseek' });
}
add({ id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash', providerFamily: 'deepseek', contextWindow: 1000000, maxTokens: 384000, inputModalities: ['text', 'image'], reasoningEfforts: ['off', 'low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'none' }, deepseekSources, 'deepseek', ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']);
add({ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro 0813', providerFamily: 'deepseek', contextWindow: 1000000, maxTokens: 384000, inputModalities: ['text'], reasoningEfforts: ['off', 'low', 'high', 'max'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'none' }, deepseekSources, 'deepseek');
const openaiSearch = 'https://developers.openai.com/api/docs/guides/tools-web-search';
add({ id: 'gpt-4.1', name: 'GPT-4.1', providerFamily: 'openai', contextWindow: 1047576, maxTokens: 32768, inputModalities: ['text', 'image'], reasoningEfforts: ['off'], defaultReasoningEffort: 'off', supportsTools: true, defaultTemperature: 1, nativeSearch: 'openai-responses' }, ['https://developers.openai.com/api/docs/models/gpt-4.1', openaiSearch], 'none', ['gpt-4.1-2025-04-14']);
for (const id of ['o3', 'o4-mini']) add({ id, name: id, providerFamily: 'openai', contextWindow: 200000, maxTokens: 100000, inputModalities: ['text', 'image'], reasoningEfforts: ['low', 'medium', 'high'], defaultReasoningEffort: 'medium', supportsTools: true, nativeSearch: 'openai-responses' }, ['https://developers.openai.com/api/docs/models/' + id, 'https://developers.openai.com/api/docs/guides/reasoning', openaiSearch], 'openai', [id + '-2025-04-16']);
add({ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', providerFamily: 'openai', contextWindow: 1050000, maxTokens: 128000, inputModalities: ['text', 'image'], reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultReasoningEffort: 'medium', supportsTools: true, nativeSearch: 'openai-responses' }, ['https://developers.openai.com/api/docs/models/gpt-6.1-sol', 'https://developers.openai.com/api/docs/guides/reasoning'], 'openai');
entries.at(-1)!.documentation.toolsProtocols = ['responses'];
for (const [id, name, efforts, defaultEffort] of [
  ['gpt-6-sol', 'GPT-6 Sol', ['off', 'low', 'medium', 'high', 'xhigh', 'max'], 'medium'],
  ['gpt-6-astra', 'GPT-6 Astra', ['low', 'medium', 'high', 'xhigh', 'max'], 'medium'],
  ['gpt-6-luna', 'GPT-6 Luna', ['off', 'low', 'medium', 'high', 'xhigh', 'max'], 'medium'],
] as const) {
  add({ id, name, providerFamily: 'openai', contextWindow: 1050000, maxTokens: 128000, inputModalities: ['text', 'image'], reasoningEfforts: [...efforts], defaultReasoningEffort: defaultEffort, supportsTools: true, nativeSearch: 'openai-responses' }, ['https://developers.openai.com/api/docs/models/' + id, 'https://developers.openai.com/api/docs/guides/latest-model', openaiSearch], 'openai');
  entries.at(-1)!.documentation.toolsProtocols = ['responses'];
}
for (const [id, name, efforts, aliases] of [
  ['gpt-5.6-sol', 'GPT-5.6 Sol', ['off', 'low', 'medium', 'high', 'xhigh', 'max'], ['gpt-5.6']],
  ['gpt-5.6-terra', 'GPT-5.6 Terra', ['off', 'low', 'medium', 'high', 'xhigh', 'max'], []],
  ['gpt-5.5', 'GPT-5.5', ['off', 'low', 'medium', 'high', 'xhigh'], ['gpt-5.5-2026-04-23']],
] as const) {
  add({ id, name, providerFamily: 'openai', contextWindow: 1050000, maxTokens: 128000, inputModalities: ['text', 'image'], reasoningEfforts: [...efforts], defaultReasoningEffort: 'medium', supportsTools: true, nativeSearch: 'openai-responses' }, ['https://developers.openai.com/api/docs/models/' + id, 'https://developers.openai.com/api/docs/guides/reasoning', openaiSearch], 'openai', [...aliases]);
  entries.at(-1)!.documentation.toolsProtocols = ['responses'];
}
add({ id: 'gpt-4o', name: 'GPT-4o', providerFamily: 'openai', contextWindow: 128000, maxTokens: 16384, inputModalities: ['text', 'image'], reasoningEfforts: ['off'], defaultReasoningEffort: 'off', supportsTools: true, defaultTemperature: 1, nativeSearch: 'none' }, ['https://developers.openai.com/api/docs/models/gpt-4o', openaiSearch], 'none', ['gpt-4o-2024-05-13', 'gpt-4o-2024-08-06', 'gpt-4o-2024-11-20']);
entries.at(-1)!.documentation.nativeSearch = 'unverified';
add({ id: 'claude-opus-5-5', name: 'Claude Opus 5.5', providerFamily: 'anthropic', contextWindow: 1000000, maxTokens: 128000, inputModalities: ['text', 'image'], reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultReasoningEffort: 'medium', supportsTools: true, nativeSearch: 'anthropic-messages' }, ['https://platform.claude.com/docs/en/models/overview', 'https://platform.claude.com/docs/en/build-with-claude/thinking', 'https://platform.claude.com/docs/en/build-with-claude/effort', 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool'], 'anthropic-adaptive');
add({ id: 'grok-4.7', name: 'Grok 4.7', providerFamily: 'xai', contextWindow: 500000, inputModalities: ['text', 'image'], reasoningEfforts: ['low', 'medium', 'high', 'xhigh'], defaultReasoningEffort: 'high', supportsTools: true, nativeSearch: 'openai-responses' }, ['https://docs.x.ai/developers/models/grok-4.7', 'https://docs.x.ai/developers/tools/web-search', 'https://docs.x.ai/developers/model-capabilities/text/reasoning'], 'xai');
// Unverified legacy records remain discoverable without inventing capabilities.
for (const [id, name, providerFamily, source] of [
  ['deepseek-chat', 'DeepSeek Chat', 'deepseek', deepseekSources[0]], ['deepseek-reasoner', 'DeepSeek Reasoner', 'deepseek', deepseekSources[0]],
  ['deepseek-v4.1-flash', 'DeepSeek V4.1 Flash (网关型号)', 'deepseek', deepseekSources[0]],
  ['claude-3-7-sonnet-20250219', 'Claude 3.7 Sonnet', 'anthropic', 'https://platform.claude.com/docs/en/models/overview'],
  ['claude-sonnet-4-20250514', 'Claude Sonnet 4', 'anthropic', 'https://platform.claude.com/docs/en/models/overview'],
  ['claude-opus-4-1-20250805', 'Claude Opus 4.1', 'anthropic', 'https://platform.claude.com/docs/en/models/overview'],
  ['grok-3', 'Grok 3', 'xai', 'https://docs.x.ai/developers/models'], ['grok-3-mini', 'Grok 3 Mini', 'xai', 'https://docs.x.ai/developers/models'], ['grok-4', 'Grok 4', 'xai', 'https://docs.x.ai/developers/models'],
] as const) {
  entries.push({ defaults: { id, name, providerFamily, inputModalities: ['text'], reasoningEfforts: ['off'], defaultReasoningEffort: 'off', supportsTools: false, nativeSearch: 'none' }, documentation: { sources: [source], checkedAt: '2026-10-11', image: 'unverified', tools: 'unverified', reasoning: 'unverified', nativeSearch: 'unverified', reasoningStyle: 'none', temperature: false } });
}
export const OFFICIAL_MODEL_CATALOG: readonly OfficialModelDefaults[] = entries.flatMap(({ defaults, documentation }) => [defaults, ...(documentation.aliases ?? []).map(id => ({ ...defaults, id }))]);
const byId = new Map(entries.flatMap(entry => [entry.defaults.id, ...(entry.documentation.aliases ?? [])].map(id => [id, entry] as const)));
export function officialModelDefaults(id: string, protocol?: GatewayProtocol): OfficialModelDefaults | undefined {
  const entry = byId.get(id.trim());
  if (!entry) return undefined;
  const d = { ...entry.defaults, id: id.trim() };
  if (protocol) {
    const doc = entry.documentation;
    d.nativeSearch = nativeModeForProtocol(d.nativeSearch, protocol);
    if (doc.toolsProtocols && !doc.toolsProtocols.includes(protocol)) d.supportsTools = false;
    if (doc.reasoningProtocols && !doc.reasoningProtocols.includes(protocol)) { d.reasoningEfforts = ['off']; d.defaultReasoningEffort = 'off'; }
    if (doc.imageProtocols && !doc.imageProtocols.includes(protocol)) d.inputModalities = ['text'];
  }
  return d;
}
export function modelDocumentation(id: string): ModelDocumentation | undefined { return byId.get(id.trim())?.documentation; }
export function nativeModeForProtocol(mode: NativeSearchMode | undefined, protocol: GatewayProtocol): NativeSearchMode { const expected = protocol === 'responses' ? 'openai-responses' : protocol === 'anthropic-messages' ? 'anthropic-messages' : 'openai-chat'; return mode === expected ? mode : 'none'; }
export function enrichModel(model: Partial<GatewayModel> & Pick<GatewayModel, 'id'>, protocol?: GatewayProtocol): GatewayModel {
  const defaults = officialModelDefaults(model.id, protocol);
  const nativeSearch = model.nativeSearch ?? (protocol ? nativeModeForProtocol(defaults?.nativeSearch, protocol) : defaults?.nativeSearch) ?? 'none';
  const efforts: Effort[] = model.reasoningEfforts?.length ? [...model.reasoningEfforts] : [...(defaults?.reasoningEfforts ?? ['off'])];
  return { ...defaults, ...model, id: model.id, name: model.name ?? defaults?.name,
    contextWindow: model.contextWindow ?? defaults?.contextWindow, maxTokens: model.maxTokens ?? defaults?.maxTokens,
    inputModalities: model.inputModalities?.length ? [...model.inputModalities] : [...(defaults?.inputModalities ?? ['text'])],
    reasoningEfforts: efforts, defaultReasoningEffort: model.defaultReasoningEffort ?? (efforts.includes(defaults?.defaultReasoningEffort ?? 'off') ? defaults?.defaultReasoningEffort ?? 'off' : efforts[0]),
    supportsTools: model.supportsTools ?? defaults?.supportsTools ?? false, defaultTemperature: model.defaultTemperature ?? defaults?.defaultTemperature, nativeSearch,
    supportsWebSearch: model.supportsWebSearch ?? ((model.supportsTools ?? defaults?.supportsTools ?? false) || nativeSearch !== 'none'),
  };
}
export const CAPABILITY_FIELDS = ['inputModalities', 'providerFamily', 'reasoningEfforts', 'defaultReasoningEffort', 'supportsTools', 'defaultTemperature', 'nativeSearch', 'nativeSearchConfig', 'nativeSearchMaxUses', 'supportsWebSearch', 'contextWindow', 'maxTokens', 'imagePixelBudget', 'imageMaxBytes'] as const;
export function restoreOfficialDefaults(model: GatewayModel, protocol: GatewayProtocol): GatewayModel {
  const identity = { ...model }; for (const field of CAPABILITY_FIELDS) delete identity[field];
  if (!officialModelDefaults(model.id)) { identity.contextWindow = model.contextWindow; identity.maxTokens = model.maxTokens; }
  return enrichModel(identity, protocol);
}
