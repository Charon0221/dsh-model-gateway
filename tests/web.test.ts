import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfiles } from '../src/config.js';
import { GatewayWebSearchProvider } from '../src/web.js';

test('gateway web provider routes native Responses search and normalizes citations', async () => {
  const profiles = resolveProfiles({ providers: { gateway: { baseURL: 'https://gateway.example/v1', apiKeyEnv: 'TEST_KEY', models: [{ id: 'gpt-4.1', nativeSearch: 'openai-responses' }] } } });
  let request: RequestInit | undefined;
  const provider = new GatewayWebSearchProvider(() => profiles, async () => 'secret-key', () => 'gateway', async (_url, init) => {
    request = init;
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'answer', annotations: [{ type: 'url_citation', url: 'https://example.com', title: 'Example' }] }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const result = await provider.search({ query: 'latest news' });
  assert.equal(result.sources[0].url, 'https://example.com');
  assert.equal(result.sources[0].title, 'Example');
  assert.match(String(request?.body), /web_search_preview/);
  assert.match(String(request?.headers && new Headers(request.headers as HeadersInit).get('authorization')), /Bearer secret-key/);
});

test('gateway web provider reports cancellation and quota errors without exposing credentials', async () => {
  const profiles = resolveProfiles({ providers: { gateway: { baseURL: 'https://gateway.example/v1', apiKeyEnv: 'TEST_KEY', models: [{ id: 'gpt-4.1', nativeSearch: 'openai-responses' }] } } });
  const provider = new GatewayWebSearchProvider(() => profiles, async () => 'sk-private', () => 'gateway', async () => new Response(JSON.stringify({ error: { message: 'Insufficient Balance' } }), { status: 402 }));
  await assert.rejects(provider.search({ query: 'x' }), error => error instanceof Error && error.message.includes('HTTP 402') && !error.message.includes('sk-private'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(provider.search({ query: 'x' }, controller.signal), /网页搜索已取消/);
});
