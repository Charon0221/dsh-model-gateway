import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { LlmError, createUserMessage, createAssistantMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm';
import { translateResponses, translateAnthropic, translate } from '../src/stream.js';
import { serializeRequest } from '../src/serialize.js';
import { resolveProfiles } from '../src/config.js';
import { GatewayAdapter } from '../src/adapter.js';

async function* events(items: unknown[]) { for (const item of items) yield typeof item === 'string' ? item : JSON.stringify(item); }
async function collect(stream: AsyncIterable<any>) { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return chunks; }
const call = (id = 'a', args = '') => ({ type: 'function_call', id: `item-${id}`, call_id: `call-${id}`, name: 'web_fetch', arguments: args });
const added = (id = 'a') => ({ type: 'response.output_item.added', item: call(id) });
const done = (id = 'a', args = '{"url":"https://example.com"}') => ({ type: 'response.function_call_arguments.done', item_id: `item-${id}`, arguments: args });
const completed = (output?: unknown[]) => ({ type: 'response.completed', response: { status: 'completed', ...(output ? { output } : {}) } });
const ends = (chunks: any[]) => chunks.filter(c => c.type === 'block-end').map(c => c.block);
const errorCode = (code: string) => (error: unknown) => error instanceof LlmError && error.code === code;
const citation = { type: 'url_citation', url: 'https://example.com/news', title: 'News' };

test('Responses complete arguments survive done-only, item-only and terminal-only gateways', async () => {
  for (const sequence of [
    [added(), done(), completed()],
    [{ type: 'response.output_item.done', item: call('a', '{"url":"https://example.com"}') }, completed()],
    [completed([call('a', '{"url":"https://example.com"}')])],
  ]) {
    const chunks = await collect(translateResponses(events(sequence)));
    assert.deepEqual(ends(chunks), [{ type: 'tool-call', id: 'call-a', name: 'web_fetch', arguments: '{"url":"https://example.com"}' }]);
    assert.equal(chunks.filter(c => c.type === 'block-start').length, 1);
  }
});

test('Responses interleaved deltas and repeated snapshots produce each argument exactly once', async () => {
  const sequence = [added('a'), added('b'),
    { type: 'response.function_call_arguments.delta', item_id: 'item-a', delta: '{"url":' },
    done('b', '{"url":"https://example.org"}'), done('a'), done('a'),
    { type: 'response.output_item.done', item: call('a', '{"url":"https://example.com"}') },
    completed([call('a', '{"url":"https://example.com"}'), call('b', '{"url":"https://example.org"}')]),
  ];
  const chunks = await collect(translateResponses(events(sequence)));
  assert.equal(ends(chunks).length, 2);
  for (const block of ends(chunks)) {
    const reconstructed = chunks.filter(c => c.type === 'tool-call-delta' && c.id === block.id).map(c => c.argumentsDelta).join('');
    assert.equal(reconstructed, block.arguments);
    assert.ok(JSON.parse(block.arguments).url);
  }
});

test('Responses reject conflicting identities/arguments, invalid objects and interrupted calls before sealing', async () => {
  for (const sequence of [
    [added(), done(), done('a', '{"url":"https://other.com"}'), completed()],
    [added(), { type: 'response.output_item.done', item: { ...call(), call_id: 'different' } }, completed()],
    [added(), completed()], [added(), done('a', '[]'), completed()],
    [added(), done('a', 'null'), completed()],
    [added(), done(), { type: 'response.incomplete', response: { status: 'incomplete' } }],
  ]) {
    const sealed: unknown[] = [];
    await assert.rejects((async () => { for await (const chunk of translateResponses(events(sequence))) if (chunk.type === 'block-end') sealed.push(chunk); })(), errorCode('MALFORMED_RESPONSE'));
    assert.equal(sealed.length, 0);
  }
  await assert.rejects(collect(translateResponses(events([added(), '[DONE]']))), errorCode('STREAM_CLOSED'));
  await assert.rejects(collect(translateResponses(events([added()]))), errorCode('STREAM_CLOSED'));
});

test('Responses server search and repeated citations become source links, never local calls', async () => {
  const chunks = await collect(translateResponses(events([
    { type: 'response.web_search_call.in_progress', item_id: 'search' },
    { type: 'response.output_item.done', output_index: 0, item: { type: 'web_search_call', id: 'search', status: 'completed', action: { sources: [{ url: citation.url }] } } },
    { type: 'response.output_text.delta', output_index: 1, delta: 'Current news.' },
    { type: 'response.output_text.annotation.added', annotation: citation },
    completed([{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [{ type: 'output_text', text: 'Current news.', annotations: [citation] }] }]),
  ]), [], { nativeSearch: true }));
  assert.equal(ends(chunks).filter(b => b.type === 'tool-call').length, 0);
  const text = ends(chunks).map(b => b.text).join('');
  assert.equal(text.split(citation.url).length - 1, 1);
  assert.match(text, /Current news\./);
  assert.match(text, /\[News\]/);
});

test('Anthropic server search deltas do not become executable tools, citations remain visible', async () => {
  const chunks = await collect(translateAnthropic(events([
    { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', name: 'web_search', id: 'server' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"query":"news"}' } },
    { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: citation.url, title: 'News' }] } },
    { type: 'content_block_start', index: 2, content_block: { type: 'text', text: 'News.' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' },
  ]), [], { nativeSearch: true }));
  assert.equal(ends(chunks).filter(b => b.type === 'tool-call').length, 0);
  assert.match(ends(chunks).map(b => b.text).join(''), /example.com\/news/);
  await assert.rejects(collect(translateAnthropic(events([{ type: 'content_block_start', index: 0, content_block: { type: 'web_search_tool_result', content: [{ type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' }] } }]))), errorCode('NATIVE_SEARCH_FAILED'));
});

test('Chat Completions citations become deduplicated links', async () => {
  const chunks = await collect(translate(events([
    { choices: [{ delta: { content: 'News', annotations: [{ type: 'url_citation', url_citation: citation }] }, finish_reason: 'stop' }] },
    { choices: [], citations: [citation] }, '[DONE]',
  ]), [], { nativeSearch: true }));
  assert.equal(ends(chunks).map(b => b.text).join('').split(citation.url).length - 1, 1);
});

test('native search failure and unexpected web_search functions never fall back to official search', async () => {
  const fn = { ...call(), name: 'web_search', arguments: '{"queries":["news"]}' };
  await assert.rejects(collect(translateResponses(events([completed([fn])]), [], { nativeSearch: true })), errorCode('NATIVE_SEARCH_UNSUPPORTED'));
  await assert.rejects(collect(translateResponses(events([{ type: 'response.web_search_call.failed' }]), [], { nativeSearch: true })), errorCode('NATIVE_SEARCH_FAILED'));
  await assert.rejects(collect(translateResponses(events([{ type: 'response.web_search_call.completed' }, completed()]), [], { nativeSearch: true })), errorCode('NATIVE_SEARCH_RESPONSE_INVALID'));
  await assert.rejects(collect(translate(events([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call', function: { name: 'web_search', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] }, '[DONE]']), [], { nativeSearch: true })), errorCode('NATIVE_SEARCH_UNSUPPORTED'));
  await assert.rejects(collect(translateAnthropic(events([{ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'call', name: 'web_search', input: {} } }, { type: 'message_stop' }]), [], { nativeSearch: true })), errorCode('NATIVE_SEARCH_UNSUPPORTED'));
});

test('native capability replaces only search and its guidance with the bridge disabled', async () => {
  for (const [protocol, nativeSearch] of [['responses', 'openai-responses'], ['anthropic-messages', 'anthropic-messages'], ['chat-completions', 'openai-chat']] as const) {
    const p = resolveProfiles({ providers: { gateway: { baseURL: 'https://example.com/v1', protocol, webSearch: { enabled: false }, models: [{ id: 'custom', nativeSearch }] } } }).get('gateway')!;
    const body = await serializeRequest({ provider: 'gateway', model: 'custom', messages: [], system: 'Keep unrelated instructions.\n\nUse the web_search tool to find news.', tools: [{ name: 'web_search', parameters: {} }, { name: 'web_fetch', parameters: {} }] }, p);
    const json = JSON.stringify(body);
    assert.match(json, /server-side native search/);
    assert.match(json, /Keep unrelated instructions/);
    assert.doesNotMatch(json, /Use the web_search tool/);
    assert.match(json, /web_fetch/);
    assert.ok(protocol === 'chat-completions' ? body.web_search_options : (body.tools as any[]).some(t => typeof t.type === 'string' && t.type.startsWith('web_search')));
  }
});

test('HTTP native search, complete-only fetch parameters and tool continuation round trip', async t => {
  const bodies: any[] = [];
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const piece of req) raw += piece;
    const body = JSON.parse(raw); bodies.push(body);
    assert.equal(req.url, '/v1/responses');
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const output = bodies.length === 1
      ? [{ type: 'web_search_call', status: 'completed', action: { sources: [citation] } }, call('a', '{"url":"https://example.com/news"}')]
      : [{ type: 'message', content: [{ type: 'output_text', text: 'Verified news.', annotations: [citation] }] }];
    res.end(`data: ${JSON.stringify(completed(output))}\n\n`);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const p = resolveProfiles({ providers: { gateway: { baseURL: `http://127.0.0.1:${(server.address() as any).port}/v1`, protocol: 'responses', webSearch: { enabled: false }, models: [{ id: 'custom', nativeSearch: 'openai-responses' }] } } });
  const adapter = new GatewayAdapter({ profiles: () => p, resolveApiKey: async () => 'test-key' });
  const user = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Latest news?' }] });
  const tools = [{ name: 'web_search', parameters: {} }, { name: 'web_fetch', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } }];
  const first = ends(await collect(adapter.stream({ provider: 'gateway', model: 'custom', messages: [user], tools })));
  const fetch = first.find(b => b.type === 'tool-call');
  assert.equal(JSON.parse(fetch.arguments).url, citation.url);
  const second = await collect(adapter.stream({ provider: 'gateway', model: 'custom', tools, messages: [user, createAssistantMessage({ source: { provider: 'gateway', model: 'custom' }, content: first }), createToolResultMessage({ callId: fetch.id, content: [{ type: 'text', text: 'Page content' }], isError: false })] }));
  assert.match(ends(second).map(b => b.text).join(''), /Verified news/);
  assert.equal(bodies[1].input.find((i: any) => i.type === 'function_call_output').call_id, fetch.id);
  assert.ok(bodies.every(body => body.tools.some((tool: any) => tool.type === 'web_search') && !body.tools.some((tool: any) => tool.type === 'function' && tool.name === 'web_search')));
});
