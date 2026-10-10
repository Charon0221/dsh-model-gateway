/** Opt-in, small paid API probes. Never persist or print the credential. */
import { GatewayAdapter } from '../src/adapter.js';
import { resolveProfiles } from '../src/config.js';
import { EFFORTS, SENJIX_PRESET } from '../src/shared.js';
import { createUserMessage, createAssistantMessage, createToolResultMessage, ReasoningEffortId, type StreamChunk, type ContentBlock } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
const key = process.env.SENJIX_API_KEY;
if (!key) throw new Error('请通过 SENJIX_API_KEY 环境变量配置验收凭据');
const url = process.env.DSG_LIVE_BASE_URL ?? SENJIX_PRESET.baseURL;
const model = process.env.DSG_LIVE_MODEL ?? SENJIX_PRESET.models[0].id;
const profiles = resolveProfiles({ providers: { senjix: { baseURL: url, apiKeyEnv: 'SENJIX_API_KEY', models: [{ id: model, inputModalities: ['text', 'image'] }], maxTokens: 1024, streamIdleTimeoutMs: 60000 } } });
const user = (text: string) => createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
const summaries: Record<string, unknown>[] = [];
async function attempt(label: string, options: any, services = {}) {
  const chunks: StreamChunk[] = [];
  const start = Date.now();
  try {
    const adapter = new GatewayAdapter({ profiles: () => profiles, resolveApiKey: async () => key!, ...services });
    for await (const chunk of adapter.stream({ provider: 'senjix', model, ...options })) chunks.push(chunk);
    const content = chunks.filter(c => c.type === 'block-end').map(c => c.block);
    const reasoning = content.filter(b => b.type === 'reasoning').map(b => b.text).join('');
    const text = content.filter(b => b.type === 'text').map(b => b.text).join('');
    const finish = chunks.find(c => c.type === 'finish');
    summaries.push({ probe: label, elapsedMs: Date.now() - start, finish: finish?.reason.kind, reasoningChars: reasoning.length, text: text.slice(0, 240), toolCalls: content.filter(b => b.type === 'tool-call').map(b => ({ name: b.name, arguments: b.arguments })), usage: chunks.find(c => c.type === 'usage')?.usage });
    return content;
  } catch (e) {
    summaries.push({ probe: label, elapsedMs: Date.now() - start, code: (e as any).code, message: (e instanceof Error ? e.message : 'unknown').split(key!).join('[redacted]') });
    return [];
  }
}
for (const effort of EFFORTS) await attempt(`effort-${effort}`, { messages: [user('计算 17×19，只输出数字。')], reasoningEffort: ReasoningEffortId(effort) });
const first = await attempt('native-tools', { messages: [user('请调用 lookup_secret 工具查找 alpha 的值，然后告诉我结果。值只能从工具获得。')], reasoningEffort: ReasoningEffortId('high'), tools: [{ name: 'lookup_secret', description: 'Return secret value for a given label', parameters: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] } }] });
const calls = first.filter(b => b.type === 'tool-call');
if (calls.length) {
  const history = [user('请调用 lookup_secret 工具查找 alpha 的值，然后告诉我结果。值只能从工具获得。'), createAssistantMessage({ source: { provider: 'senjix', model }, content: first }), ...calls.map(c => createToolResultMessage({ callId: c.id, content: [{ type: 'text', text: 'alpha=7319' }], isError: false }))];
  await attempt('tool-result-continuation', { messages: history, reasoningEffort: ReasoningEffortId('high') });
}
// Generate a 64×64 red raster in memory using sharp from the installed runtime.
const { createRequire } = await import('node:module');
const runtimeRequire = createRequire(process.env.DSG_RUNTIME_PACKAGE ?? 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/package.json');
try {
  const sharp = runtimeRequire('sharp');
  const bytes: Buffer = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ff0000' } }).png().toBuffer();
  const ref: any = { attachmentId: 'live-red-square', mediaType: 'image/png', width: 64, height: 64, bytes: bytes.length, depth: 'uchar', space: 'srgb', hasAlpha: false, name: 'red.png' };
  const attachments = { readImageRequest: async () => ({ attachment: ref, variantId: 'red-square', data: bytes, mediaType: 'image/png', bytes: bytes.length, width: 64, height: 64, depth: 'uchar', space: 'srgb', hasAlpha: false }) } as unknown as AttachmentStore;
  await attempt('vision-red-square', { messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '这张图片主要是什么颜色？只输出颜色。' }, { type: 'image', attachment: ref }] })], reasoningEffort: ReasoningEffortId('off') }, { attachments });
} catch { summaries.push({ probe: 'vision-red-square', code: 'LOCAL_IMAGE_SETUP_FAILED' }); }
console.log(JSON.stringify({ baseURL: url, model, results: summaries, interpretation: 'HTTP 成功及推理文本长度仅证明协议接受和输出行为，不能证明网关真实应用了各档位。' }, null, 2));
