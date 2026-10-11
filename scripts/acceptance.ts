/** Local paid acceptance: existing desktop route/key, sanitized output only. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import YAML from 'yaml';
import { GatewayAdapter } from '../src/adapter.js';
import { resolveProfiles } from '../src/config.js';
import { createUserMessage, createAssistantMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm';
const dir = 'C:/Users/Administrator/.dsh/profiles/desktop';
const config = YAML.parse(fs.readFileSync(dir + '/cordis.patch.yml', 'utf8')).find((p: any) => p.name === 'dsh-model-gateway').config;
const raw = config.providers.senjix;
const key = YAML.parse(fs.readFileSync('C:/Users/Administrator/.dsh/.credentials.yaml', 'utf8')).refs[raw.apiKeyEnv];
const modelOverrides = process.env.DSG_ACCEPT_GATEWAY_ALIAS === '1' ? [{ id: 'deepseek-v4.1-flash', providerFamily: 'deepseek' as const, inputModalities: ['text', 'image'] as ('text'|'image')[], supportsTools: true, reasoningEfforts: ['off', 'low', 'high', 'max'] as const, defaultReasoningEffort: 'high' as const }] : [{ id: 'deepseek-flash' }, { id: 'gpt-6.1-sol' }, { id: 'grok-4.7' }];
const profiles = resolveProfiles({ providers: { senjix: { ...raw, models: modelOverrides as any, webSearch: { enabled: false } } } });
const deepseek = modelOverrides[0].id;
const fetchOriginal = globalThis.fetch;
const evidence: any[] = []; const reports: any[] = [];
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(String(init?.body));
  const record: any = { endpoint: String(url), model: body.model, reasoning: body.reasoning, thinking: body.thinking, tools: body.tools?.map((t: any) => ({ type: t.type, name: t.name ?? t.function?.name })) };
  evidence.push(record);
  const response = await fetchOriginal(url, init); record.status = response.status;
  if (response.ok) {
    const [used, observed] = response.body!.tee();
    void (async () => { const reader = observed.getReader(); const decoder = new TextDecoder(); let text = ''; for (;;) { const { done, value } = await reader.read(); if (done) break; text += decoder.decode(value, { stream: true }); } record.searchEvents = [...text.matchAll(/"type"\s*:\s*"(response\.web_search_call\.[^"]+)"/g)].map(m => m[1]); })();
    return new Response(used, { status: response.status, headers: response.headers });
  }
  return response;
};
const user = (text: string) => createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
async function run(label: string, model: string, options: any, services = {}) {
  const start = Date.now(); const blocks: any[] = [];
  try {
    const adapter = new GatewayAdapter({ profiles: () => profiles, resolveApiKey: async () => key, ...services });
    for await (const chunk of adapter.stream({ provider: 'senjix', model, maxTokens: 2048, signal: AbortSignal.timeout(180000), ...options })) if (chunk.type === 'block-end') blocks.push(chunk.block);
    reports.push({ label, model, elapsedMs: Date.now()-start, blocks });
  } catch (e) { reports.push({ label, model, elapsedMs: Date.now()-start, code: (e as any).code, error: String(e).split(key).join('[redacted]') }); }
  fs.writeFileSync('test-results/capability-live.json', JSON.stringify({ evidence, reports }, null, 2));
  console.log(JSON.stringify(reports.at(-1))); return blocks;
}
const tools = [{ name: 'lookup_secret', description: 'Get a private test value by label', parameters: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] } }];
const first = await run('deepseek-tool', deepseek, { messages: [user('调用 lookup_secret 查询 alpha 的值，必须从工具读取。')], tools, reasoningEffort: 'low' });
const calls = first.filter(b => b.type === 'tool-call');
if (calls.length) await run('deepseek-continuation', deepseek, { messages: [user('查询 alpha 的值'), createAssistantMessage({ source: { provider: 'senjix', model: deepseek }, content: first }), ...calls.map(c => createToolResultMessage({ callId: c.id, content: [{ type: 'text', text: 'alpha=7319' }], isError: false }))], tools, reasoningEffort: 'low' });
try {
  const require = createRequire('C:/Users/Administrator/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/package.json'); const sharp = require('sharp');
  const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ff0000' } }).png().toBuffer();
  const ref: any = { attachmentId: 'acceptance-red', mediaType: 'image/png', width: 64, height: 64, bytes: bytes.length, depth: 'uchar', space: 'srgb', hasAlpha: false, name: 'red.png' };
  await run('deepseek-image', deepseek, { messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '图片主要是什么颜色？只说颜色。' }, { type: 'image', attachment: ref }] })], reasoningEffort: 'off' }, { attachments: { readImageRequest: async () => ({ attachment: ref, variantId: 'red', data: bytes, mediaType: 'image/png', bytes: bytes.length, width: 64, height: 64 }) } });
} catch (e) { console.log('image setup unavailable'); }
if (process.env.DSG_ACCEPT_GATEWAY_ALIAS !== '1') for (const model of ['gpt-6.1-sol', 'grok-4.7']) await run('native-search', model, { reasoningEffort: 'low', messages: [user('必须使用服务端原生网页搜索确认 nodejs.org 当前 LTS 版本，只回答版本和官方来源链接。')], tools: [{ name: 'web_search', parameters: { type: 'object', properties: { query: { type: 'string' } } } }] });
globalThis.fetch = fetchOriginal;
