import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enrichModel, modelDocumentation, officialModelDefaults, restoreOfficialDefaults } from '../src/catalog.js';
import { migrateCapabilities, capabilityMigrationOps } from '../src/migration.js';
import { resolveProfiles } from '../src/config.js';
import { serializeRequest } from '../src/serialize.js';
import { NS, PROTOCOLS, type GatewayModel } from '../src/shared.js';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

test('exact official models, documented aliases, protocol defaults and manual overrides', () => {
  const flash = enrichModel({ id: 'deepseek-flash' }, 'responses');
  assert.deepEqual(flash.inputModalities, ['text', 'image']);
  assert.equal(flash.contextWindow, 1000000); assert.equal(flash.maxTokens, 384000);
  assert.equal(flash.nativeSearch, 'none'); assert.equal(modelDocumentation(flash.id)?.nativeSearch, 'unsupported');
  assert.equal(officialModelDefaults('deepseek-v4-flash')?.name, flash.name);
  assert.equal(modelDocumentation('deepseek-v4.1-flash')?.image, 'unverified');
  assert.equal(enrichModel({ id: 'deepseek-v4.1-flash' }).supportsTools, false);
  for (const id of ['gpt-secret', 'grok-unknown', 'senjix/gpt-6.1-sol']) {
    assert.equal(officialModelDefaults(id), undefined);
    const unknown = enrichModel({ id });
    assert.equal(unknown.supportsTools, false); assert.equal(unknown.nativeSearch, 'none');
    assert.deepEqual(unknown.inputModalities, ['text']); assert.deepEqual(unknown.reasoningEfforts, ['off']);
  }
  assert.equal(modelDocumentation('grok-3')?.tools, 'unverified');
  assert.equal(officialModelDefaults('gpt-6.1-sol', 'chat-completions')?.supportsTools, false);
  assert.equal(officialModelDefaults('gpt-6.1-sol', 'responses')?.supportsTools, true);
  assert.equal(officialModelDefaults('grok-4.7', 'chat-completions')?.nativeSearch, 'none');
  assert.equal(officialModelDefaults('grok-4.7', 'responses')?.nativeSearch, 'openai-responses');
  assert.equal(officialModelDefaults('claude-opus-5-5', 'anthropic-messages')?.nativeSearch, 'anthropic-messages');
  assert.equal(officialModelDefaults('claude-opus-5-5', 'responses')?.supportsTools, false);
  assert.equal(enrichModel({ id: flash.id, supportsTools: false }).supportsTools, false);
  assert.equal(restoreOfficialDefaults({ ...flash, supportsTools: false, name: 'my name', description: 'keep' }, 'responses').name, 'my name');
});

test('search disabled retains fetch on all protocols; vendor reasoning never leaks DeepSeek thinking', async () => {
  for (const protocol of PROTOCOLS) {
    const profile = resolveProfiles({ providers: { test: { baseURL: 'http://localhost/v1', protocol, models: [{ id: 'custom', supportsTools: true, supportsWebSearch: false }] } } }).get('test')!;
    const body = await serializeRequest({ provider: 'test', model: 'custom', messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'test' }] })], tools: ['web_search', 'web_fetch'].map(name => ({ name, parameters: { type: 'object' } })) }, profile, profile.models[0]);
    assert.equal((body.tools as any[]).length, 1);
    assert.equal((body.tools as any[])[0].name ?? (body.tools as any[])[0].function.name, 'web_fetch');
  }
  for (const [id, protocol] of [['gpt-6.1-sol', 'responses'], ['grok-4.7', 'chat-completions'], ['claude-opus-5-5', 'anthropic-messages']] as const) {
    const profile = resolveProfiles({ providers: { test: { baseURL: 'http://localhost/v1', protocol, models: [{ id }] } } }).get('test')!;
    const body = await serializeRequest({ provider: 'test', model: id, messages: [], temperature: 1, stop: ['END'] }, profile, profile.models[0]);
    assert.equal(body.temperature, undefined);
    if (protocol === 'anthropic-messages') { assert.deepEqual(body.thinking, { type: 'adaptive' }); assert.deepEqual(body.output_config, { effort: 'medium' }); }
    else { assert.equal(body.thinking, undefined); assert.equal(body.stop, undefined); }
  }
});

test('migration backs up, fences revision, preserves non-capabilities and runs only once', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsg-migration-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const documentPath = join(dir, 'cordis.patch.yml'); await writeFile(documentPath, 'private original config');
  const providers = { test: { baseURL: 'https://existing.example/v1', protocol: 'responses' as const, apiKeyEnv: 'EXISTING_KEY', headers: { 'x-gateway-key': 'private' }, webSearch: { enabled: false }, models: [{ id: 'deepseek-flash', name: 'unchanged', supportsTools: false, nativeSearch: 'openai-responses' as const }] } };
  let writes = 0;
  const ops = capabilityMigrationOps(providers);
  assert.deepEqual(ops, JSON.parse(JSON.stringify(ops)), 'Settings API values must contain no undefined properties');
  const settings = { documentPath, writable: true, describe: () => [{ ns: NS, revision: 7, value: { providers } } as any], mutate: async (ns: string, ops: any, revision?: number) => { assert.equal(ns, NS); assert.equal(revision, 7); writes++; providers.test.models = ops[0].value; } };
  await Promise.all([migrateCapabilities(settings), migrateCapabilities(settings)]);
  assert.equal(writes, 1); assert.equal(providers.test.models[0].supportsTools, true); assert.equal(providers.test.models[0].nativeSearch, 'none');
  assert.equal(providers.test.models[0].name, 'unchanged'); assert.equal(providers.test.headers['x-gateway-key'], 'private'); assert.equal(providers.test.webSearch.enabled, false);
  providers.test.models[0].supportsTools = false;
  await migrateCapabilities(settings); assert.equal(writes, 1); assert.equal(providers.test.models[0].supportsTools, false);
  const marker = JSON.parse(await readFile(join(dir, '.plugin-manager/migrations/official-capabilities-v1.json'), 'utf8'));
  assert.equal(await readFile(marker.backup, 'utf8'), 'private original config');
});

test('readonly does not write; interrupted commit is recovered without a second reset', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsg-migration-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const documentPath = join(dir, 'cordis.patch.yml'); await writeFile(documentPath, 'original');
  let models: GatewayModel[] = [{ id: 'deepseek-flash', supportsTools: false }]; let writes = 0;
  const settings = { documentPath, writable: false, describe: () => [{ ns: NS, revision: 3, value: { providers: { test: { protocol: 'responses', models } } } } as any], mutate: async (_ns: string, ops: any) => { writes++; models = ops[0].value; throw new Error('simulated crash after commit'); } };
  assert.equal(await migrateCapabilities(settings), 'readonly'); assert.deepEqual(await readdir(dir), ['cordis.patch.yml']);
  settings.writable = true;
  await assert.rejects(migrateCapabilities(settings), /crash/);
  models = models.map(m => ({ ...m, nativeSearchConfig: {} }));
  assert.equal(await migrateCapabilities(settings), 'complete'); assert.equal(writes, 1);
});
test('revision conflict leaves backup and a retryable incomplete journal', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsg-conflict-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const documentPath = join(dir, 'cordis.patch.yml'); await writeFile(documentPath, 'original');
  const settings = { documentPath, writable: true, describe: () => [{ ns: NS, revision: 4, value: { providers: { test: { models: [{ id: 'deepseek-flash' }] } } } } as any], mutate: async () => { throw new Error('revision conflict'); } };
  await assert.rejects(migrateCapabilities(settings), /revision conflict/);
  const marker = JSON.parse(await readFile(join(dir, '.plugin-manager/migrations/official-capabilities-v1.json'), 'utf8'));
  assert.equal(marker.complete, false); assert.equal(await readFile(marker.backup, 'utf8'), 'original');
});
