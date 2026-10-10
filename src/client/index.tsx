import React, { useState, useSyncExternalStore } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client';
import { NS, type GatewayProfile } from '../shared.js';
import { GatewayEditor } from './Editor.js';
import type { ClientOperations } from './controller.js';

interface Section { providers?: Record<string, GatewayProfile> }
interface Injected { scope: SettingsScope<Section>; operations: ClientOperations; taken: () => readonly string[] }
function useSnapshot(scope: SettingsScope<Section>) { return useSyncExternalStore(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope), scope.getSnapshot.bind(scope)); }
export function GatewayFooter({ scope, operations, taken }: Injected) {
  const state = useSnapshot(scope);
  const [open, setOpen] = useState<'custom' | 'senjix'>();
  if (state.status !== 'ready') return null;
  return <section className="dsg-panel" aria-label="第三方 DeepSeek 网关">
    <h3>第三方 DeepSeek</h3>
    {open ? <GatewayEditor revision={state.revision!} taken={taken()} writable={state.writable} preset={open === 'senjix'} operations={operations} onClose={() => setOpen(undefined)} />
      : <div className="dsg-actions"><button type="button" disabled={!state.writable} onClick={() => setOpen('custom')}>添加第三方 DeepSeek</button><button type="button" disabled={!state.writable} onClick={() => setOpen('senjix')}>使用深极云算预填</button></div>}
  </section>;
}
export function GatewayCard({ provider, scope, operations, taken }: Injected & ProviderCardExtrasOwnerProps) {
  const state = useSnapshot(scope);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const route = provider.provider;
  const profile = state.value?.providers?.[route];
  if (!profile) return null;
  const baseProviders = state.base as Section | undefined;
  const fromBase = !!baseProviders?.providers?.[route];
  const remove = async () => {
    setBusy(true); setFailure('');
    try {
      // Removing a composition-backed row would merely re-inherit it.
      await operations.write([{ op: 'unset', path: ['providers', route] }], state.revision!);
    } catch (error) { setFailure(error instanceof Error ? error.message : '删除失败'); }
    finally { setBusy(false); setConfirmDelete(false); }
  };
  return <div className="dsg-panel">
    {open ? <GatewayEditor key={route} route={route} initial={profile} revision={state.revision!} taken={taken()} writable={state.writable} operations={operations} onClose={() => setOpen(false)} />
      : <div className="dsg-actions"><button type="button" onClick={() => setOpen(true)}>编辑网关与模型能力</button><button type="button" disabled={!state.writable || busy || fromBase} onClick={() => setConfirmDelete(true)}>删除本网关</button></div>}
    {confirmDelete && <div role="alertdialog" aria-label={`删除 ${route}`}><p>确认删除网关 {route}？凭据保留在 dsh 中，可在凭据管理中单独删除。</p><button type="button" disabled={busy} onClick={remove}>确认删除</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button></div>}
    {fromBase && <p className="dsg-hint">该网关来自组合配置；请在对应 patch 中移除。</p>}
    {failure && <p role="alert" className="dsg-error">{failure}</p>}
  </div>;
}
export const inject = ['slots', 'settingsScope', 'remote', 'remote.settings', 'remote.credentials', 'remote.llm'];
export function apply(ctx: Context): void {
  const scope = ctx.settingsScope.bind<Section>({ namespace: NS });
  let routes: readonly string[] = [];
  let active = true;
  const refresh = async () => {
    const response = await ctx.remote.llm.listProviders();
    if (active && response.ok) routes = response.value.map(p => p.id);
  };
  void refresh().catch(() => {});
  ctx.effect(() => {
    const dispose = ctx.remote.$on('llm/adapters-updated', () => { void refresh().catch(() => {}); });
    const reconnect = ctx.on('connection/reset', () => { void refresh().catch(() => {}); });
    return () => { active = false; dispose(); reconnect(); };
  });
  const operations: ClientOperations = {
    write: async (ops, revision) => {
      const response = await ctx.remote.settings.mutate(NS, ops, revision);
      if (!response.ok) throw new Error(response.error.code === 'settings/conflict' ? '配置已被其他页面修改，请关闭编辑器并重新打开' : response.error.message);
      return response.value;
    },
    credential: async ref => { const r = await ctx.remote.credentials.describe([ref]); return r.ok ? r.value[ref] : undefined; },
    storeKey: async (ref, key) => { const r = await ctx.remote.credentials.set(ref, key); if (!r.ok) throw new Error(r.error.message); },
    removeKey: async ref => { const r = await ctx.remote.credentials.unset(ref); if (!r.ok) throw new Error(r.error.message); },
    discover: async request => { const r = await ctx.remote.llm.discoverModels(NS, request); if (!r.ok) throw new Error(r.error.message); return r.value; },
  };
  const injected = () => ({ scope, operations, taken: () => [...new Set([...routes, ...Object.keys(scope.getSnapshot().value?.providers ?? {})])] });
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({ name: 'settings.models.footer', id: NS, order: 20, inject: injected }, GatewayFooter));
  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({ name: 'settings.models.provider-card', key: NS, inject: injected }, GatewayCard));
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-deepseek-gateway';
    style.textContent = `.dsg-panel{margin-top:16px;padding:16px;border:1px solid var(--border-color,#8884);border-radius:10px}.dsg-editor h3,.dsg-panel h3{margin:0 0 12px}.dsg-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.dsg-fields label{display:flex;flex-direction:column;gap:6px;font-size:13px}.dsg-panel input:not([type=checkbox]),.dsg-panel select{box-sizing:border-box;width:100%;padding:8px;border:1px solid #8885;border-radius:6px;background:transparent;color:inherit}.dsg-panel button{padding:7px 12px;border:1px solid #8885;border-radius:6px;background:transparent;color:inherit;cursor:pointer}.dsg-panel button:disabled{opacity:.5;cursor:default}.dsg-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.dsg-models fieldset,.dsg-discovery{margin:12px 0;border:1px solid #8884;border-radius:6px;padding:12px}.dsg-hint{font-size:12px;opacity:.7}.dsg-error{color:#dc5555;font-size:13px}.dsg-checkbox{display:block;margin:12px 0}.dsg-candidates{max-height:240px;overflow:auto}.dsg-candidates label{display:flex;gap:8px;padding:5px 0}.dsg-panel input:focus-visible,.dsg-panel button:focus-visible,.dsg-panel select:focus-visible{outline:2px solid #568cf5;outline-offset:2px}`;
    document.head.append(style);
    return () => style.remove();
  });
}
