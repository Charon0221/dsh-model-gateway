import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { GatewayEditor } from '../src/client/Editor.js';
import type { ClientOperations } from '../src/client/controller.js';

test('Models editor renders preset, recovers discovery failure and saves a manually edited model', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  let closed = false;
  let saved: any;
  const operations = {
    credential: async () => ({ configured: false, writable: true }),
    discover: async () => { throw new Error('模型列表不可用，请手工填写'); },
    write: async (ops: any[]) => { saved = ops; return { revision: 2 }; },
    storeKey: async () => {}, removeKey: async () => {},
  } as unknown as ClientOperations;
  const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent === text)!;
  try {
    await act(async () => { root.render(<GatewayEditor preset revision={1} taken={[]} writable operations={operations} onClose={() => { closed = true; }} />); });
    assert.ok([...container.querySelectorAll('input')].some(i => i.value === 'https://senjix.cloud/v1'));
    assert.ok([...container.querySelectorAll('input')].some(i => i.value === 'deepseek-v4.1-flash'));
    assert.equal(container.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked, false);
    await act(async () => { button('获取可用模型').click(); });
    assert.match(container.textContent!, /模型列表不可用/);
    await act(async () => { container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click(); });
    await act(async () => { button('保存').click(); });
    assert.equal(closed, true);
    assert.deepEqual(saved[0].value.models[0].inputModalities, ['text', 'image']);
    assert.equal(saved[0].value.apiKeyEnv, 'SENJIX_API_KEY');
    assert.equal(JSON.stringify(saved).includes('apiKey"'), false);
  } finally {
    await act(async () => { root.unmount(); }); dom.window.close();
  }
});
