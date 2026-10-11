import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { GatewayEditor } from '../src/client/Editor.js';
import type { ClientOperations } from '../src/client/controller.js';
import { Selection } from '../src/client/controls.js';

test('Models editor renders preset, recovers discovery failure and saves a manually edited model', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0), cancelAnimationFrame: (id: number) => clearTimeout(id), getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true });
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
  const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text))!;
  try {
    await act(async () => { root.render(<GatewayEditor preset revision={1} taken={[]} writable operations={operations} onClose={() => { closed = true; }} />); });
    await act(async () => { container.querySelector<HTMLElement>('[data-disclosure-row]')!.click(); });
    assert.ok([...container.querySelectorAll('input')].some(i => i.value === 'https://senjix.cloud/v1'));
    assert.ok([...container.querySelectorAll('input')].some(i => i.value === 'deepseek-flash'));
    assert.equal(container.querySelector('[role="dialog"]'), null);
    assert.ok(container.querySelector('.dsg-model-entry'));
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="展开模型能力"]')!.click(); });
    assert.equal(container.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked, true);
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="网关操作"]')!.click(); });
    await act(async () => { [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.includes('模型目录'))!.click(); });
    await act(async () => { [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.includes('获取网关模型'))!.click(); });
    assert.match(container.textContent!, /模型列表不可用/);
    await act(async () => { [...container.querySelectorAll<HTMLLabelElement>('label')].find(label => label.textContent?.includes('图片'))!.querySelector<HTMLInputElement>('input')!.click(); });
    await act(async () => { button('保存').click(); });
    assert.equal(closed, true);
    assert.deepEqual(saved[0].value.models[0].inputModalities, ['text']);
    assert.equal(saved[0].value.apiKeyEnv, 'SENJIX_API_KEY');
    assert.equal(JSON.stringify(saved).includes('apiKey"'), false);
  } finally {
    await act(async () => { root.unmount(); }); dom.window.close();
  }
});

test('native menu supports keyboard selection; editor restores defaults and retains save errors', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.getElementById('root')!; const root = createRoot(container);
  let selected = ''; const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text))!;
  try {
    await act(async () => { root.render(<Selection label="Protocol" value="chat" options={[{ value: 'chat', label: 'Chat' }, { value: 'responses', label: 'Responses' }]} onChange={value => { selected = value; }} />); });
    await act(async () => { container.querySelector('button')!.focus(); container.querySelector('button')!.click(); });
    assert.equal(document.activeElement?.getAttribute('role'), 'menuitem');
    await act(async () => { document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    await act(async () => { document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); });
    assert.equal(selected, 'responses'); assert.equal(document.querySelector('[role=menu]'), null);
    let attempted: any;
    const operations = { credential: async () => ({ configured: true, writable: true }), write: async (ops: any[]) => { attempted = ops; throw new Error('配置 revision 冲突'); } } as unknown as ClientOperations;
    await act(async () => { root.render(<GatewayEditor route="test" initial={{ baseURL: 'https://example.com/v1', apiKeyEnv: 'EXISTING', protocol: 'responses', models: [{ id: 'deepseek-flash', name: '我的模型', description: '保留说明', supportsTools: false, inputModalities: ['text'], nativeSearchConfig: { type: 'web_search_preview' }, nativeSearchMaxUses: 9, imageMaxBytes: 1234 }], webSearch: { enabled: false } }} revision={1} taken={[]} writable operations={operations} onClose={() => {}} />); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="展开模型能力"]')!.click(); });
    await act(async () => { button('恢复官方默认').click(); });
    assert.match(container.textContent!, /2026-10-11/); assert.equal(container.querySelector('a')?.getAttribute('href'), 'https://api-docs.deepseek.com/quick_start/pricing/');
    assert.equal(container.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked, true);
    assert.equal(container.querySelector('[role=switch]')?.getAttribute('aria-checked'), 'false');
    await act(async () => { button('保存').click(); });
    const restored = attempted.find((op: any) => op.path[2] === 'models').value[0];
    assert.equal(restored.nativeSearchConfig, undefined);
    assert.equal(restored.nativeSearchMaxUses, undefined);
    assert.equal(restored.imageMaxBytes, undefined);
    assert.equal(restored.name, '我的模型');
    assert.equal(restored.description, '保留说明');
    assert.match(container.querySelector('[role=alert]')!.textContent!, /revision 冲突/);
    assert.equal(container.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked, true);
  } finally { await act(async () => { root.unmount(); }); dom.window.close(); }
});
