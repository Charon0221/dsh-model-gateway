import { Button, Modal, Tag, StateDot } from '@deepseek-ai/dsh-client-ui-primitives';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client';
import { NS, type GatewayProfile } from '../shared.js';
import { GatewayEditor } from './Editor.js';
import type { ClientOperations } from './controller.js';
import { checkForUpdate, PLUGIN_VERSION, type PluginUpdateInfo } from './updates.js';

interface Section { providers?: Record<string, GatewayProfile> }
interface Injected { scope: ConfigForm<Section>; operations: ClientOperations; taken: () => readonly string[]; ctx: Context }
function useSnapshot(scope: ConfigForm<Section>) { return useSyncExternalStore(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope), scope.getSnapshot.bind(scope)); }
export function GatewayFooter({ scope, operations, taken, ctx }: Injected) {
  const state = useSnapshot(scope);
  const [open, setOpen] = useState<'custom' | 'senjix'>();
  const [update, setUpdate] = useState<PluginUpdateInfo | null>();
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  useEffect(() => { let active = true; void checkForUpdate().then(value => { if (active) setUpdate(value); }); return () => { active = false; }; }, []);
  const copyInstallSpec = async () => {
    if (!update || !navigator.clipboard) return;
    try { await navigator.clipboard.writeText(update.installSpec); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard permission is optional */ }
  };
  const installUpdate = async () => {
    if (!update || updating) return;
    const manager = (ctx.remote as any).pluginManager;
    if (!manager?.installBundle) {
      setUpdateMessage('当前 DSH 未提供自动更新接口，请复制安装地址后到插件设置中更新。');
      return;
    }
    setUpdating(true); setUpdateMessage('');
    try {
      const result = await manager.installBundle(update.installSpec, { enabled: true });
      if (!result?.ok) throw new Error(result?.error?.message ?? '插件更新请求失败');
      const value = result.value;
      if (value?.application === 'failed' || value?.error) throw new Error(value.error?.diagnostic ?? '插件更新失败');
      setUpdateMessage(value?.application === 'restart-required' || value?.application === 'applied'
        ? '更新已安装，重启 DSH 后生效。'
        : '更新请求已提交，请到插件设置查看状态。');
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : '插件更新失败，请复制安装地址手动更新。');
    } finally { setUpdating(false); }
  };
  if (state.status !== 'ready') return null;
  return <section className="dsg-section" aria-label="第三方模型网关">
    <div className="dsg-section-heading"><div><h3>第三方模型网关</h3><p>连接深极云算提供的模型，可选择 OpenAI Chat Completions、OpenAI Responses 或 Anthropic Messages 协议。</p></div></div>
    {update && <div className="dsg-update" role="status"><span>发现新版本 v{update.latestVersion}（当前 v{PLUGIN_VERSION}）。</span><Button variant="primary" type="button" disabled={updating} onClick={installUpdate}>{updating ? '更新中…' : '更新插件'}</Button><a href={update.releaseUrl} target="_blank" rel="noreferrer">查看发布说明</a><Button variant="ghost" type="button" onClick={copyInstallSpec}>{copied ? '已复制安装地址' : '复制安装地址'}</Button><p>{updateMessage || '更新后按桌面端提示重启 DSH；如果当前版本没有自动更新接口，可复制安装地址手动更新。'}</p></div>}
    {open ? <GatewayEditor revision={state.revision!} taken={taken()} writable={state.writable} preset={open === 'senjix'} operations={operations} onClose={() => setOpen(undefined)} />
      : <div className="dsg-add-actions"><Button variant="ghost" type="button" disabled={!state.writable} onClick={() => setOpen('custom')}>添加模型网关</Button><Button variant="ghost" type="button" disabled={!state.writable} onClick={() => setOpen('senjix')}>使用深极云算预填</Button></div>}
  </section>;
}
export function GatewayCard({ provider, scope, operations, taken }: Injected & ProviderCardExtrasOwnerProps) {
  const state = useSnapshot(scope);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [credential, setCredential] = useState<{ configured?: boolean }>();
  const route = provider.provider;
  const profile = state.value?.providers?.[route];
  React.useEffect(() => { let active = true; if (profile) operations.credential(profile.apiKeyEnv ?? '').then(value => { if (active) setCredential(value); }).catch(() => {}); return () => { active = false; }; }, [operations, profile?.apiKeyEnv]);
  if (!profile) return null;
  const fromBase = !!(state.base as Section | undefined)?.providers?.[route];
  const remove = async () => {
    setBusy(true); setFailure('');
    try {
      await operations.write([{ op: 'unset', path: ['providers', route] }], state.revision!);
    } catch (error) { setFailure(error instanceof Error ? error.message : '删除失败'); }
    finally { setBusy(false); setConfirmDelete(false); }
  };
  return <div className="dsg-card">
    <div className="dsg-card-header"><div className="dsg-card-identity"><StateDot state={credential?.configured ? 'done' : 'error'} /><div><strong>{profile.displayName ?? route}</strong><Tag>{route}</Tag></div></div><span className="dsg-card-meta">{profile.models.length} 个模型</span></div>
    {open ? <GatewayEditor key={route} route={route} initial={profile} revision={state.revision!} taken={taken()} writable={state.writable} operations={operations} onClose={() => setOpen(false)} />
      : <div className="dsg-actions dsg-card-actions"><Button variant="outline" type="button" onClick={() => setOpen(true)}>编辑网关与模型能力</Button><Button variant="ghost" type="button" disabled={!state.writable || busy || fromBase} onClick={() => setConfirmDelete(true)}>删除本网关</Button></div>}
    <Modal open={confirmDelete} title={`删除 ${route}`} description="确认删除本网关？凭据会保留在 DSH 中。" closeLabel="关闭确认" onClose={() => { if (!busy) setConfirmDelete(false); }} footer={<><Button variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</Button><Button variant="primary" disabled={busy} onClick={remove}>确认删除</Button></>} />
    {fromBase && <p className="dsg-hint dsg-card-hint">该网关来自组合配置；请在对应 patch 中移除。</p>}
    {failure && <p role="alert" className="dsg-error">{failure}</p>}
  </div>;
}
export const inject = ['slots', 'configForms', 'remote', 'remote.settings', 'remote.credentials', 'remote.llm', 'remote.pluginManager'];
export function apply(ctx: Context): void {
  const scope = ctx.configForms.get<Section>(NS);
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
    discover: async request => { const r = await ctx.remote.llm.discoverModels(NS, request); if (!r.ok) throw new Error(r.error.message); return r.value as import('../shared.js').GatewayModel[]; },
  };
  const injected = () => ({ scope, operations, taken: () => [...new Set([...routes, ...Object.keys(scope.getSnapshot().value?.providers ?? {})])], ctx });
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({ name: 'settings.models.footer', id: NS, order: 20, inject: injected }, GatewayFooter));
  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({ name: 'settings.models.provider-card', key: NS, inject: injected }, GatewayCard));
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-model-gateway';
    style.textContent = `
      .dsg-section,.dsg-editor,.dsg-card,.dsg-group,.dsg-model-detail{display:flex;flex-direction:column;gap:12px;min-width:0;color:var(--dsw-alias-label-primary)}
      .dsg-section{max-width:720px}.dsg-card,.dsg-editor{padding:12px 0}.dsg-group{padding:12px 0;border-top:.5px solid var(--dsw-alias-settings-card-stroke)}
      .dsg-section h3,.dsg-editor h3,.dsg-group h4{margin:0;font-weight:500}.dsg-section h3{font-size:16px}.dsg-group h4{font-size:14px}
      .dsg-section-heading,.dsg-card-header,.dsg-card-identity,.dsg-card-identity>div,.dsg-actions,.dsg-capability{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dsg-section-heading,.dsg-card-header{justify-content:space-between}
      .dsg-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dsg-field{display:flex;flex-direction:column;gap:6px;min-width:0}.dsg-field>span,.dsg-card-meta{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsg-models{display:flex;flex-direction:column;gap:8px}.dsg-model-card{display:flex;flex-direction:column;gap:10px;border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);padding:12px;background:var(--dsw-alias-settings-card-fill)}
      .dsg-model-detail[hidden]{display:none}.dsg-efforts{display:flex;flex-wrap:wrap;gap:12px}.dsg-efforts>span{flex-basis:100%;font-size:12px}
      .dsg-hint,.dsg-error,.dsg-success{margin:0;font-size:12px;line-height:18px}.dsg-hint{color:var(--dsw-alias-label-tertiary)}.dsg-error{color:var(--dsw-alias-state-error-primary)}.dsg-success{color:var(--dsw-alias-state-success-primary)}
      .dsg-editor-actions{justify-content:flex-end}.dsg-add-actions{display:flex;gap:8px;flex-wrap:wrap}.dsg-discovery{display:flex;flex-direction:column;gap:10px}.dsg-candidates{display:flex;flex-direction:column;gap:8px;max-height:280px;overflow:auto}.dsg-candidate{display:flex;gap:8px;flex-wrap:wrap}
      .dsg-update{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dsg-update p{margin:0;flex-basis:100%}.dsg-editor a{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
      @media(width<=560px){.dsg-fields{grid-template-columns:1fr}.dsg-section-heading{align-items:flex-start}.dsg-actions{gap:6px}}
    `;
    document.head.append(style);
    return () => style.remove();
  });
}
