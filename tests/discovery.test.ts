import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { discoverModels } from '../src/discovery.js';
import { resolveProfiles } from '../src/config.js';
import { LlmError } from '@deepseek-ai/dsh-llm';

test('model discovery uses route headers and credentials, deduplicates candidates without guessing vision', async t => {
  let auth: string | undefined;
  let custom: string | string[] | undefined;
  const server = createServer((req, res) => {
    auth = req.headers.authorization; custom = req.headers['x-gateway'];
    res.setHeader('content-type', 'application/json');
    if (req.url === '/bad/models') { res.end('{}'); return; }
    res.end(JSON.stringify({ data: [{ id: 'gpt-4.1', context_window: 1, max_tokens: 2 }, { id: 'vision', context_window: 8192, max_tokens: 1024, inputModalities: ['image'] }, { id: 'vision' }, { id: 'text' }, null] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const baseURL = `http://127.0.0.1:${(server.address() as any).port}`;
  const profiles = resolveProfiles({ providers: { gateway: { baseURL, models: [{ id: 'text' }], headers: { 'x-gateway': 'route-header' } } } });
  const candidates = await discoverModels({ provider: 'gateway' }, profiles, async () => 'local-key');
  assert.equal(auth, 'Bearer local-key'); assert.equal(custom, 'route-header');
  assert.deepEqual(candidates.map(m => m.id), ['gpt-4.1', 'vision', 'text']);
  assert.equal(candidates[1].contextWindow, 8192); assert.equal(candidates[1].maxTokens, 1024);
  assert.deepEqual(candidates[0].inputModalities, ['text', 'image']);
  assert.equal(candidates[0].contextWindow, 1047576);
  assert.equal(candidates[0].maxTokens, 32768);
  assert.deepEqual(candidates[1].inputModalities, ['text']); assert.equal(candidates[1].supportsTools, false);
  await assert.rejects(discoverModels({ baseURL: `${baseURL}/bad`, apiKey: 'draft-key' }, profiles, async () => 'unused'), e => e instanceof LlmError && e.code === 'MALFORMED_RESPONSE');
  const cancel = new AbortController(); cancel.abort();
  await assert.rejects(discoverModels({ provider: 'gateway' }, profiles, async () => 'key', cancel.signal), e => e instanceof LlmError && e.code === 'ABORTED');
});
