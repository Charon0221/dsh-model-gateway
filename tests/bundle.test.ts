import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';

test('distributed client loads through harness module loader and disposes slots/styles', async () => {
  const dom = new JSDOM('<html><head></head><body></body></html>');
  const require = createRequire(import.meta.url);
  let entry: any;
  runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(module: any) { assert.equal(module.id, 'dsh-deepseek-gateway'); entry = module.factory(require); } } },
    document: dom.window.document,
  });
  const disposers: (() => void)[] = [];
  const registrations: any[] = [];
  const ctx = {
    configForms: { get: () => ({ getSnapshot: () => ({ value: {} }) }) },
    remote: { llm: { listProviders: async () => ({ ok: true, value: [] }) }, $on: () => () => {} },
    on: () => () => {},
    effect: (fn: () => () => void) => disposers.push(fn()),
    slots: { inject: (_: string, fn: () => void) => fn(), register: (config: any) => { registrations.push(config); disposers.push(() => registrations.splice(registrations.indexOf(config), 1)); } },
  };
  entry.apply(ctx);
  assert.deepEqual(registrations.map(r => r.name), ['settings.models.footer', 'settings.models.provider-card']);
  assert.equal(registrations[1].key, 'llm-deepseek-gateway');
  assert.equal(dom.window.document.head.querySelectorAll('style').length, 1);
  const style = dom.window.document.head.querySelector('style[data-plugin="dsh-deepseek-gateway"]')!;
  assert.match(style.textContent!, /--dsw-alias-label-primary/);
  assert.match(style.textContent!, /--dsw-radius-lg/);
  assert.doesNotMatch(style.textContent!, /#8884|#8885|#568cf5/);
  for (const dispose of disposers.reverse()) dispose();
  assert.equal(registrations.length, 0);
  assert.equal(dom.window.document.head.querySelectorAll('style').length, 0);
  dom.window.close();
});
