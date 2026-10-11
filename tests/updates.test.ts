import test from 'node:test';
import assert from 'node:assert/strict';
import { checkForUpdate, isNewerVersion, resetUpdateCache } from '../src/client/updates.js';

test('release versions compare without treating malformed tags as updates', () => {
  assert.equal(isNewerVersion('0.2.0', 'v0.2.1'), true);
  assert.equal(isNewerVersion('0.2.1', 'v0.2.1'), false);
  assert.equal(isNewerVersion('0.2.9', 'v0.2.0'), false);
  assert.equal(isNewerVersion('0.2.0', 'latest'), false);
});

test('release check returns an install spec and caches successful checks', async () => {
  resetUpdateCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return new Response(JSON.stringify({ tag_name: 'v9.1.0', html_url: 'https://github.com/example/release' }), { status: 200 });
  };
  const first = await checkForUpdate(fetchImpl, 1000);
  const second = await checkForUpdate(fetchImpl, 1001);
  assert.deepEqual(first, { currentVersion: '0.3.4', latestVersion: '9.1.0', releaseUrl: 'https://github.com/example/release', installSpec: 'github:Charon0221/dsh-model-gateway#v9.1.0' });
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('release check fails closed when GitHub is unavailable', async () => {
  resetUpdateCache();
  const result = await checkForUpdate(async () => { throw new Error('offline'); }, 2000);
  assert.equal(result, null);
});
