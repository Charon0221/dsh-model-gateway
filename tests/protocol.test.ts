import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { GatewayAdapter } from '../src/adapter.js';
import { resolveProfiles } from '../src/config.js';
import { translate, mapUsage } from '../src/stream.js';
import { serializeRequest } from '../src/serialize.js';
import { ReasoningEffortId, ToolCallId, attributionHeaders, createAssistantMessage, createUserMessage, createToolResultMessage, LlmError } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore, ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment';

const input = () => createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } });
const options = (): GenerateOptions => ({ provider: 'test', model: 'deepseek', messages: [input()] });
const profile = (extra = {}) => resolveProfiles({ providers: { test: { baseURL: 'http://localhost/v1', models: [{ id: 'deepseek' }], ...extra } } }).get('test')!;
const payload = (delta: object, finish: string | null = null) => JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] });
async function* strings(items: string[]) { yield* items; }
async function collect<T>(items: AsyncIterable<T>) { const all: T[] = []; for await (const item of items) all.push(item); return all; }
const code = (expected: string) => (e: unknown) => e instanceof LlmError && e.code === expected;

test('interleaved tool deltas preserve identity, raw arguments, reasoning and trailing usage', async () => {
  const chunks = await collect(translate(strings([
    payload({ reasoning_content: '' }), payload({ reasoning_content: '想一想' }),
    payload({ tool_calls: [{ index: 1, id: 'b', type: 'function', function: { name: 'second', arguments: '{"b":' } }] }),
    payload({ tool_calls: [{ index: 0, id: 'a', function: { name: 'first', arguments: '{"a":' } }] }),
    payload({ tool_calls: [{ index: 1, id: null, function: { name: '', arguments: '2}' } }, { index: 0, id: '', function: { name: null, arguments: '1}' } }] }, 'tool_calls'),
    JSON.stringify({ choices: [], usage: { prompt_tokens: 100, completion_tokens: 8, prompt_cache_hit_tokens: 60, total_tokens: 108 } }), '[DONE]',
  ])));
  const end = chunks.filter(c => c.type === 'block-end');
  assert.deepEqual(end.map(c => c.block), [
    { type: 'reasoning', text: '想一想' },
    { type: 'tool-call', id: 'b', name: 'second', arguments: '{"b":2}' },
    { type: 'tool-call', id: 'a', name: 'first', arguments: '{"a":1}' },
  ]);
  assert.deepEqual(chunks.slice(-2), [{ type: 'usage', usage: { inputTokens: 40, outputTokens: 8, totalTokens: 108, cacheReadTokens: 60 } }, { type: 'finish', reason: { kind: 'tool-calls' } }]);
  assert.equal(chunks.filter(c => c.type === 'block-start').length, end.length);
});
test('invalid JSON, absent DONE, missing finish and malformed identities fail safely', async () => {
  await assert.rejects(collect(translate(strings(['{']))), code('MALFORMED_RESPONSE'));
  await assert.rejects(collect(translate(strings([payload({ content: 'partial' }, 'stop')]))), code('STREAM_CLOSED'));
  await assert.rejects(collect(translate(strings([payload({ content: 'partial' }), '[DONE]']))), code('MALFORMED_RESPONSE'));
  for (const calls of [
    [{ index: 0, function: { name: 'f', arguments: '{}' } }],
    [{ index: 0, id: 'a', function: { name: 'f' } }, { index: 1, id: 'a', function: { name: 'g' } }],
  ]) await assert.rejects(collect(translate(strings([payload({ tool_calls: calls }, 'tool_calls'), '[DONE]']))), code('MALFORMED_RESPONSE'));
  await assert.rejects(collect(translate(strings([payload({ tool_calls: [{ index: 0, id: 'a', function: { name: 'f' } }] }), payload({ tool_calls: [{ index: 0, id: 'changed' }] }, 'tool_calls'), '[DONE]']))), code('MALFORMED_RESPONSE'));
});
test('usage never double counts cache; inconsistent totals omitted; empty response classified', async () => {
  assert.deepEqual(mapUsage({ prompt_tokens: 10, completion_tokens: 2, total_tokens: 999, prompt_tokens_details: { cached_tokens: 3 }, completion_tokens_details: { reasoning_tokens: 1 } }), { inputTokens: 7, outputTokens: 2, cacheReadTokens: 3, reasoningTokens: 1 });
  assert.equal(mapUsage({ prompt_tokens: -1, completion_tokens: 1 }), undefined);
  const chunks = await collect(translate(strings([payload({}, 'stop'), '[DONE]'])));
  assert.equal(chunks[0].type, 'finish');
  assert.equal((chunks[0] as Extract<StreamChunk, { type: 'finish' }>).reason.kind, 'error');
});
test('official effort fields and reasoning history survive tool round trips', async () => {
  const history = [input(), createAssistantMessage({ source: { provider: 'test', model: 'deepseek' }, content: [{ type: 'reasoning', text: 'must preserve' }, { type: 'tool-call', id: ToolCallId('call'), name: 'lookup', arguments: '{"x":1}' }] }), createToolResultMessage({ callId: ToolCallId('call'), content: [{ type: 'text', text: '42' }], isError: false })];
  for (const effort of ['off', 'low', 'high', 'max']) {
    const body = await serializeRequest({ ...options(), messages: history, reasoningEffort: ReasoningEffortId(effort), system: 'sys', stop: ['END'], temperature: .1, tools: [{ name: 'lookup', description: 'read', parameters: { type: 'object' } }] }, profile());
    assert.deepEqual(body.thinking, { type: effort === 'off' ? 'disabled' : 'enabled' });
    assert.equal(body.reasoning_effort, effort === 'off' ? undefined : effort);
    const msgs = body.messages as any[];
    assert.equal(msgs[2].reasoning_content, 'must preserve');
    assert.equal(msgs[3].tool_call_id, 'call');
    assert.equal(msgs[3].content, '42');
    assert.equal((body.tools as any[])[0].function.name, 'lookup');
  }
  const title = await serializeRequest({ ...options(), purpose: 'session-title' }, profile());
  assert.deepEqual(title.thinking, { type: 'disabled' });
  assert.equal(title.reasoning_effort, undefined);
});

const ref = { attachmentId: 'image-one', mediaType: 'image/png', width: 20, height: 10, bytes: 3, name: 'shot.png', depth: 'uchar', space: 'srgb', hasAlpha: false } as unknown as ImageAttachmentRef;
const attachments = { readImageRequest: async (image: ImageAttachmentRef) => ({ attachment: image, variantId: 'variant', data: new Uint8Array([1, 2, 3]), mediaType: 'image/png', bytes: 3, width: 20, height: 10, depth: 'uchar', space: 'srgb', hasAlpha: false } as RequestImageAttachment) } as AttachmentStore;
test('user and tool screenshots serialize inline; 0.2 durable offload requests oldest image removal', async () => {
  const image = createUserMessage({ content: [{ type: 'text', text: 'look' }, { type: 'image', attachment: ref }], source: { kind: 'user' } });
  const call = createAssistantMessage({ source: { provider: 'test', model: 'deepseek' }, content: [{ type: 'tool-call', id: ToolCallId('screenshot'), name: 'screen', arguments: '{}' }] });
  const result = createToolResultMessage({ callId: ToolCallId('screenshot'), content: [{ type: 'image', attachment: ref }], isError: false });
  const p = profile({ models: [{ id: 'deepseek', inputModalities: ['text', 'image'] }] });
  const body = await serializeRequest({ ...options(), messages: [image, call, result] }, p, { attachments });
  const msgs = body.messages as any[];
  assert.equal(msgs[0].content[2].image_url.url, 'data:image/png;base64,AQID');
  assert.equal(msgs[2].role, 'tool'); assert.equal(msgs[2].tool_call_id, 'screenshot');
  assert.equal(msgs[3].role, 'user'); assert.equal(msgs[3].content[1].type, 'image_url');
  const limited = profile({ models: p.models, maxInlineRequestImageBytes: 1 });
  await assert.rejects(serializeRequest({ ...options(), messages: [image] }, limited, { attachments }), e => e instanceof LlmError && e.code === 'IMAGE_OFFLOAD_REQUIRED' && e.failure.offloadImages === 1);
  const offloaded = { ...image, content: image.content.map(block => block.type === 'image' ? { ...block, offloaded: true } : block) };
  const small = await serializeRequest({ ...options(), messages: [offloaded] }, limited, { attachments });
  assert.equal(typeof (small.messages as any[])[0].content, 'string');
  assert.match((small.messages as any[])[0].content, /image-one/);
  assert.equal(image.content[1].type, 'image');
  const text = await serializeRequest({ ...options(), messages: [image] }, profile());
  assert.equal(typeof (text.messages as any[])[0].content, 'string');
});

test('real HTTP streaming honors attribution, cancellation, idle timeout and generation snapshot', async t => {
  const requests: { url: string; body: any; headers: any }[] = [];
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const piece of req) raw += piece;
    requests.push({ url: req.url!, body: JSON.parse(raw), headers: req.headers });
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    if (req.url!.startsWith('/hang')) { res.write(': ping\n\n'); return; }
    const encoded = new TextEncoder().encode('data: ' + payload({ content: '你好' }, 'stop') + '\n\ndata: [DONE]\n\n');
    // Split every byte including the multibyte Chinese characters.
    for (const byte of encoded) res.write(Buffer.from([byte]));
    res.end();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = (server.address() as any).port;
  let profiles = resolveProfiles({ providers: { test: { baseURL: `http://127.0.0.1:${port}/old`, models: [{ id: 'deepseek' }] } } });
  const adapter = new GatewayAdapter({ profiles: () => profiles, resolveApiKey: async () => 'test-key' });
  const prepared = await adapter.prepareCall('test', 'deepseek');
  profiles = resolveProfiles({ providers: { test: { baseURL: `http://127.0.0.1:${port}/new`, models: [{ id: 'deepseek' }] } } });
  const chunks = await collect(prepared.stream(options()));
  assert.equal(requests[0].url, '/old/chat/completions');
  assert.equal(requests[0].headers.authorization, 'Bearer test-key');
  for (const [name, value] of Object.entries(attributionHeaders())) assert.equal(requests[0].headers[name.toLowerCase()], value);
  assert.equal(chunks.find(c => c.type === 'text-delta')?.text, '你好');
  await collect(adapter.stream(options())); assert.equal(requests[1].url, '/new/chat/completions');
  profiles = resolveProfiles({ providers: { test: { baseURL: `http://127.0.0.1:${port}/hang`, models: [{ id: 'deepseek' }], streamIdleTimeoutMs: 30 } } });
  await assert.rejects(collect(adapter.stream(options())), code('TIMEOUT'));
  const controller = new AbortController(); const aborting = collect(adapter.stream({ ...options(), signal: controller.signal }));
  setTimeout(() => controller.abort(), 5); await assert.rejects(aborting, code('ABORTED'));
  const blockedCredential = new GatewayAdapter({ profiles: () => profiles, resolveApiKey: () => new Promise(() => {}) });
  await assert.rejects(collect(blockedCredential.stream(options())), code('TIMEOUT'));
});

test('HTTP errors are stable, secrets removed, protocol mismatch refused', async () => {
  for (const [status, message, expected] of [[401, 'key rejected', 'AUTH'], [429, 'slow down', 'RATE_LIMIT'], [429, 'insufficient_quota', 'QUOTA'], [400, 'maximum context length exceeded', 'CONTEXT_WINDOW_EXCEEDED'], [400, 'unsupported reasoning_effort', 'INVALID_REQUEST'], [500, 'error', 'SERVER'], [504, 'timeout', 'TIMEOUT']] as const) {
    const adapter = new GatewayAdapter({ profiles: () => new Map([['test', profile()]]), resolveApiKey: async () => 'secret', fetch: async () => new Response(JSON.stringify({ error: { message: `${message}: secret` } }), { status, headers: { 'retry-after': '2' } }) });
    try { await collect(adapter.stream(options())); assert.fail('expected error'); }
    catch (e) { assert.ok(e instanceof LlmError); assert.equal(e.code, expected); assert.ok(!e.message.includes('secret')); assert.equal(e.failure.providerRetryAfterMs, 2000); }
  }
  const adapter = new GatewayAdapter({ profiles: () => new Map([['test', profile()]]), resolveApiKey: async () => 'test', fetch: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(collect(adapter.stream(options())), code('MALFORMED_RESPONSE'));
});
