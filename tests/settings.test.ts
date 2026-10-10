import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { Context } from '@deepseek-ai/cordis';
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm';
import SettingsProvider from '@deepseek-ai/dsh-settings';
import { apply, Config } from '../src/index.js';
import { resolveProfiles, apiBaseURL } from '../src/config.js';
import { SaveTransaction, validateDraft } from '../src/client/controller.js';
import type { ClientOperations } from '../src/client/controller.js';
import { NS } from '../src/shared.js';

const profile = () => ({ baseURL: 'http://localhost:9000/v1/', models: [{ id: 'deepseek' }], apiKeyEnv: 'TEST_KEY' });
class MemorySettings extends SettingsProvider {
  readonly writable = true;
  doc: Record<string, unknown> = {};
  protected async load() { return this.doc; }
  protected async persist(ns: string, section: Record<string, unknown>) { this.doc = { ...this.doc, [ns]: section }; }
  external(doc: Record<string, unknown>) { this.doc = doc; this.publish(doc); }
}

test('real Cordis settings: dormant start, live add/edit/remove, invalid external update and route collision', async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  await ctx.plugin(LlmRuntime);
  await ctx.plugin(MemorySettings);
  await ctx.plugin({ name: NS, inject: ['llm'], apply, Config }, { providers: {} });
  assert.deepEqual(ctx.llm.listProviders(), []);
  const settings = ctx.settings as MemorySettings;
  await settings.mutate(NS, [{ op: 'set', path: ['providers', 'gateway'], value: profile() }]);
  await tick();
  assert.equal(ctx.llm.listProviders()[0].id, 'gateway');
  assert.equal((await ctx.llm.resolveModelInfo('gateway', 'deepseek')).reasoning?.efforts.length, 4);
  assert.equal(ctx.llm.listConfigurableProviders()[0].settingsNs, NS);
  const before = settings.describe().find(d => d.ns === NS)!;
  await settings.mutate(NS, [{ op: 'set', path: ['providers', 'gateway', 'displayName'], value: 'changed' }], before.revision);
  await tick(); assert.equal(ctx.llm.listProviders()[0].name, 'changed');
  await assert.rejects(settings.mutate(NS, [{ op: 'set', path: ['providers', 'gateway', 'displayName'], value: 'stale' }], before.revision), /revision|conflict|moved|changed/i);
  settings.external({ [NS]: { providers: { gateway: { ...profile(), baseURL: 'bad' } } } });
  await tick(); assert.equal(ctx.llm.listProviders()[0].name, 'changed');
  class Other extends LlmAdapter { async *stream() {} }
  ctx.llm.registerAdapter(['occupied'], new Other());
  // Restore valid document so a subsequent write tests route ownership only.
  settings.external({ [NS]: { providers: { gateway: { ...profile(), displayName: 'changed' } } } });
  await tick();
  await assert.rejects(settings.mutate(NS, [{ op: 'set', path: ['providers', 'occupied'], value: profile() }]), /占用/);
  assert.deepEqual(ctx.llm.listProviders().map(p => p.id), ['gateway', 'occupied']);
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
