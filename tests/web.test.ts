import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfiles } from '../src/config.js';
import { GatewayWebSearchProvider } from '../src/web.js';

test('gateway web provider routes native Responses search and normalizes citations', async () => {
  const profiles = resolveProfiles({ providers: { gateway: { baseURL: 'https://gateway.example/v1', protocol: 'responses', apiKeyEnv: 'TEST_KEY', models: [{ id: 'gpt-4.1', nativeSearch: 'openai-responses' }] } } });
  let request: RequestInit | undefined;
  const provider = new GatewayWebSearchProvider(() => profiles, async () => 'secret-key', () => 'gateway', async (_url, init) => {
    request = init;
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'answer', annotations: [{ type: 'url_citation', url: 'https://example.com', title: 'Example' }] }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const result = await provider.search({ query: 'latest news' });
  assert.equal(result.sources[0].url, 'https://example.com');
  assert.equal(result.sources[0].title, 'Example');
  assert.match(String(request?.body), /"type":"web_search"/);
  assert.match(String(request?.headers && new Headers(request.headers as HeadersInit).get('authorization')), /Bearer secret-key/);
});

test('gateway web provider reports cancellation and quota errors without exposing credentials', async () => {
  const profiles = resolveProfiles({ providers: { gateway: { baseURL: 'https://gateway.example/v1', protocol: 'responses', apiKeyEnv: 'TEST_KEY', models: [{ id: 'gpt-4.1', nativeSearch: 'openai-responses' }] } } });
  const provider = new GatewayWebSearchProvider(() => profiles, async () => 'sk-private', () => 'gateway', async () => new Response(JSON.stringify({ error: { message: 'Insufficient Balance' } }), { status: 402 }));
  await assert.rejects(provider.search({ query: 'x' }), error => error instanceof Error && error.message.includes('HTTP 402') && !error.message.includes('sk-private'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(provider.search({ query: 'x' }, controller.signal), /网页搜索已取消/);
});

test('bridge refuses protocol mismatch and unverified search without making a request', async () => {
  for (const model of [{ id: 'gpt-4.1', nativeSearch: 'openai-responses' as const }, { id: 'unknown' }]) {
    const profiles = resolveProfiles({ providers: { gateway: { baseURL: 'https://gateway.example/v1', protocol: 'chat-completions', models: [model], webSearch: { model: model.id, allowGenericFallback: true } } } });
    let calls = 0;
    const provider = new GatewayWebSearchProvider(() => profiles, async () => 'private', () => 'gateway', async () => { calls++; throw new Error('unexpected network'); });
    assert.equal(provider.available(), false);
    await assert.rejects(provider.search({ query: 'x' }), /不匹配|未配置原生搜索/);
    assert.equal(calls, 0);
  }
});
