import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { Context } from '@deepseek-ai/cordis';
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm';
import SettingsProvider from '@deepseek-ai/dsh-settings';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import z from '@deepseek-ai/schemastery';
import { redactSecrets } from '@deepseek-ai/dsh-settings';
import { apply, Config } from '../src/index.js';
import { resolveProfiles, apiBaseURL } from '../src/config.js';
import { SaveTransaction, validateDraft } from '../src/client/controller.js';
import type { ClientOperations } from '../src/client/controller.js';
import { NS } from '../src/shared.js';

const profile = () => ({ baseURL: 'http://localhost:9000/v1/', models: [{ id: 'deepseek' }], apiKeyEnv: 'TEST_KEY' });
test('real Cordis settings: dormant start, live add/edit/remove, invalid external update and route collision', async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  await ctx.plugin(LlmRuntime);
  await ctx.plugin(Loader);
  ctx.loader.builtins.gateway = { name: NS, inject: ['llm'], apply, Config };
  ctx.provide('profileContext');
  ctx.provide('configEditor');
  ctx.set('profileContext', { home: new URL('../.test-home/settings-020', import.meta.url).pathname, name: 'test' });
  // Real SettingsForms and Loader; the editor storage boundary is in memory.
  ctx.set('configEditor', {
    documentPath: 'test.patch.yml',
    entries: () => [...ctx.loader.entries()],
    configuration: () => [...ctx.loader.entries()].map(entry => ({ entry, inherited: { providers: {} }, override: entry.options.config })),
    edit: async (entry: any, change: any) => {
      const next = change(entry.options.config, { providers: {} });
      Config(next);
      await ctx.loader.update(entry.id, { config: next });
      await ctx.loader.await();
    },
  });
  await ctx.plugin(SettingsProvider);
  await ctx.loader.root.update([{ id: NS, name: 'cordis:gateway', config: { providers: {} } }]);
  await ctx.loader.await();
  assert.deepEqual(ctx.llm.listProviders(), []);
  // internal/config is a global lifecycle: gateway validation must ignore siblings.
  let siblingStarted = false;
  await ctx.plugin({ name: 'unrelated', apply: () => { siblingStarted = true; } });
  assert.equal(siblingStarted, true);
  const settings = ctx.settings;
  await settings.mutate(NS, [{ op: 'set', path: ['providers', 'gateway'], value: profile() }]);
  await tick();
  assert.equal(ctx.llm.listProviders()[0].id, 'gateway');
  assert.equal((await ctx.llm.resolveModelInfo('gateway', 'deepseek')).reasoning?.efforts.length, 4);
  assert.equal(ctx.llm.listConfigurableProviders()[0].settingsNs, NS);
  const before = settings.describe().find(d => d.ns === NS)!;
  await settings.mutate(NS, [{ op: 'set', path: ['providers', 'gateway', 'displayName'], value: 'changed' }], before.revision);
  await tick(); assert.equal(ctx.llm.listProviders()[0].name, 'changed');
  await assert.rejects(settings.mutate(NS, [{ op: 'set', path: ['providers', 'gateway', 'displayName'], value: 'stale' }], before.revision), /revision|conflict|moved|changed/i);
  await ctx.loader.update(NS, { config: { providers: { gateway: { ...profile(), baseURL: 'bad' } } } });
  await tick(); assert.equal(ctx.llm.listProviders()[0].name, 'changed');
  class Other extends LlmAdapter { async *stream() {} }
  ctx.llm.registerAdapter(['occupied'], new Other());
  // Restore valid document so a subsequent write tests route ownership only.
  await ctx.loader.update(NS, { config: { providers: { gateway: { ...profile(), displayName: 'changed' } } } });
  await tick();
  await settings.mutate(NS, [{ op: 'set', path: ['providers', 'occupied'], value: profile() }]);
  assert.deepEqual(ctx.llm.listProviders().map(p => p.id), ['gateway', 'occupied']);
  // A conflicting external route candidate retains the entire previous registry.
  await settings.mutate(NS, [{ op: 'unset', path: ['providers', 'occupied'] }]);
  await settings.mutate(NS, [{ op: 'unset', path: ['providers', 'gateway'] }]);
  await tick(); assert.deepEqual(ctx.llm.listProviders().map(p => p.id), ['occupied']);
  assert.equal(ctx.llm.listConfigurableProviders().length, 0);
});
test('validation rejects invalid identities, capacities, URLs, headers and efforts; snapshots detach input', () => {
  assert.equal(apiBaseURL('https://example.com/v1/'), 'https://example.com/v1');
  for (const bad of [
    { ...profile(), baseURL: 'https://key:secret@example.com/v1' },
    { ...profile(), headers: { authorization: 'secret' } },
    { ...profile(), models: [{ id: 'a' }, { id: 'a' }] },
    { ...profile(), maxTokens: 1.5 }, { ...profile(), reasoningEffort: 'medium' },
  ]) assert.throws(() => resolveProfiles({ providers: { test: bad as any } }));
  const raw = profile(); const p = resolveProfiles({ providers: { test: raw } }).get('test')!;
  raw.models[0].id = 'mutated'; assert.equal(p.models[0].id, 'deepseek');
});
test('volatile form schema survives Remote JSON roundtrip and redacts gateway headers', () => {
  const form = z.object({ providers: Config.dict.providers });
  const envelope = JSON.parse(JSON.stringify(form.toJSON()));
  const schema = new z(envelope);
  delete schema.dict.providers.meta.volatile;
  assert.deepEqual(schema({ providers: {} }), { providers: {} });
  const redacted = redactSecrets(schema, { providers: { gateway: { ...profile(), headers: { 'x-gateway-key': 'private-header' } } } });
  assert.equal((redacted.value as any).providers.gateway.headers, undefined);
  assert.ok(!JSON.stringify(redacted).includes('private-header'));
});
test('UI save fences revisions, preserves undisplayed fields and retries only failed credential stage', async () => {
  let writes = 0, keys = 0;
  const operations = {
    write: async (ops: any[], rev: number) => {
      writes++; assert.equal(rev, 7); assert.ok(ops.every(op => !op.path.includes('headers')));
      return { revision: 8 };
    },
    storeKey: async () => { keys++; if (keys === 1) throw new Error('credential store unavailable'); },
  } as unknown as ClientOperations;
  const tx = new SaveTransaction(7);
  await assert.rejects(tx.save('test', profile(), 'test-key', operations, false));
  assert.equal(tx.committed, true); assert.equal(tx.revision, 8);
  await tx.save('test', profile(), 'test-key', operations, false);
  assert.equal(writes, 1); assert.equal(keys, 2);
  const conflict = new SaveTransaction(7);
  let attemptedKey = false;
  await assert.rejects(conflict.save('test', profile(), 'key', { ...operations, write: async () => { throw new Error('conflict'); }, storeKey: async () => { attemptedKey = true; } }, true));
  assert.equal(conflict.committed, false); assert.equal(attemptedKey, false);
  assert.ok(validateDraft('test', profile(), '', ['test'], true));
  assert.equal(validateDraft('test', profile(), '', ['test'], false), undefined);
});
