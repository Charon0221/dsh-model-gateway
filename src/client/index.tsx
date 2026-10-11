import { Button, Modal, Tag, StateDot, IconPlusOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client';
import { NS, type GatewayProfile } from '../shared.js';
import { GatewayEditor } from './Editor.js';
import type { ClientOperations } from './controller.js';
import { ActionMenu } from './controls.js';
import { checkForUpdate, PLUGIN_VERSION, type PluginUpdateInfo } from './updates.js';

interface Section { providers?: Record<string, GatewayProfile> }
interface Injected { scope: ConfigForm<Section>; operations: ClientOperations; taken: () => readonly string[]; ctx: Context }
function useSnapshot(scope: ConfigForm<Section>) { return useSyncExternalStore(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope), scope.getSnapshot.bind(scope)); }

export function GatewayFooter({ scope, operations, taken, ctx }: Injected) {
  const state = useSnapshot(scope); const [open, setOpen] = useState<'custom' | 'senjix'>(); const [update, setUpdate] = useState<PluginUpdateInfo | null>();
  const [copied, setCopied] = useState(false); const [updating, setUpdating] = useState(false); const [updateMessage, setUpdateMessage] = useState('');
  useEffect(() => { let active = true; void checkForUpdate().then(value => { if (active) setUpdate(value); }); return () => { active = false; }; }, []);
  const copyInstallSpec = async () => { if (!update || !navigator.clipboard) return; try { await navigator.clipboard.writeText(update.installSpec); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* optional clipboard */ } };
  const installUpdate = async () => {
    if (!update || updating) return; const manager = (ctx.remote as any).pluginManager;
    if (!manager?.installBundle) { setUpdateMessage('当前 DSH 未提供自动更新接口，请复制安装地址后到插件设置中更新。'); return; }
    setUpdating(true); setUpdateMessage(''); try { const result = await manager.installBundle(update.installSpec, { enabled: true }); if (!result?.ok) throw new Error(result?.error?.message ?? '插件更新请求失败'); const value = result.value; if (value?.application === 'failed' || value?.error) throw new Error(value.error?.diagnostic ?? '插件更新失败'); setUpdateMessage(value?.application === 'restart-required' || value?.application === 'applied' ? '更新已安装，重启 DSH 后生效。' : '更新请求已提交，请到插件设置查看状态。'); } catch (error) { setUpdateMessage(error instanceof Error ? error.message : '插件更新失败，请复制安装地址手动更新。'); } finally { setUpdating(false); }
  };
  if (state.status !== 'ready') return null;
  return <section className="dsg-section" aria-label="第三方模型网关">
    <div className="dsg-section-heading"><div><h3>第三方模型网关</h3><p>连接深极云算提供的模型，可选择 OpenAI Chat Completions、OpenAI Responses 或 Anthropic Messages 协议。</p></div></div>
    {update && <div className="dsg-update" role="status"><span>发现新版本 v{update.latestVersion}（当前 v{PLUGIN_VERSION}）。</span><Button variant="primary" type="button" disabled={updating} onClick={installUpdate}>{updating ? '更新中…' : '更新插件'}</Button><a href={update.releaseUrl} target="_blank" rel="noreferrer">查看发布说明</a><Button variant="ghost" type="button" onClick={copyInstallSpec}>{copied ? '已复制安装地址' : '复制安装地址'}</Button><p>{updateMessage || '更新后按桌面端提示重启 DSH；如果当前版本没有自动更新接口，可复制安装地址手动更新。'}</p></div>}
    {open ? <div className="dsg-add-card"><GatewayEditor revision={state.revision!} taken={taken()} writable={state.writable} preset={open === 'senjix'} operations={operations} onClose={() => setOpen(undefined)} /></div>
      : <div className="dsg-add-actions"><Button className="dsg-add-button" variant="outline" type="button" icon={<IconPlusOutlineRegular />} disabled={!state.writable} onClick={() => setOpen('custom')}>添加模型网关</Button><Button className="dsg-add-button" variant="outline" type="button" disabled={!state.writable} onClick={() => setOpen('senjix')}>使用深极云算预填</Button></div>}
  </section>;
}

export function GatewayCard({ provider, scope, operations, taken }: Injected & ProviderCardExtrasOwnerProps) {
  const state = useSnapshot(scope); const [open, setOpen] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false); const [busy, setBusy] = useState(false); const [failure, setFailure] = useState(''); const [credential, setCredential] = useState<{ configured?: boolean }>();
  const route = provider.provider; const profile = state.value?.providers?.[route];
  React.useEffect(() => { let active = true; if (profile) operations.credential(profile.apiKeyEnv ?? '').then(value => { if (active) setCredential(value); }).catch(() => {}); return () => { active = false; }; }, [operations, profile?.apiKeyEnv]);
  if (!profile) return null;
  const fromBase = !!(state.base as Section | undefined)?.providers?.[route];
  const remove = async () => { setBusy(true); setFailure(''); try { await operations.write([{ op: 'unset', path: ['providers', route] }], state.revision!); } catch (error) { setFailure(error instanceof Error ? error.message : '删除失败'); } finally { setBusy(false); setConfirmDelete(false); } };
  return <div className="dsg-provider-card">
    <header className="dsg-provider-header"><div className="dsg-provider-identity"><StateDot state={credential?.configured ? 'done' : 'error'} /><div><div className="dsg-provider-name">{profile.displayName ?? route}</div><div className="dsg-provider-meta"><Tag>{route}</Tag><span>{profile.models.length} 个模型</span></div></div></div><div className="dsg-provider-actions"><Button variant="outline" size="sm" type="button" onClick={() => setOpen(true)}>编辑</Button><ActionMenu label="网关操作" disabled={busy} items={[{ id: 'delete', label: '删除本网关', danger: true, disabled: fromBase }]} onSelect={() => setConfirmDelete(true)} /></div></header>
    {!open && <div className="dsg-provider-summary"><span>模型能力与搜索设置</span><Button variant="ghost" size="sm" type="button" onClick={() => setOpen(true)}>编辑网关与模型能力</Button></div>}
    {open && <GatewayEditor key={route} route={route} initial={profile} revision={state.revision!} taken={taken()} writable={state.writable} operations={operations} onClose={() => setOpen(false)} onDelete={fromBase ? undefined : () => setConfirmDelete(true)} />}
    <Modal open={confirmDelete} title={`删除 ${route}`} description="确认删除本网关？凭据会保留在 DSH 中。" closeLabel="关闭确认" onClose={() => { if (!busy) setConfirmDelete(false); }} footer={<><Button variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</Button><Button variant="primary" disabled={busy} onClick={remove}>确认删除</Button></>} />
    {fromBase && <p className="dsg-hint">该网关来自组合配置；请在对应 patch 中移除。</p>}{failure && <p role="alert" className="dsg-error">{failure}</p>}
  </div>;
}

export const inject = ['slots', 'configForms', 'remote', 'remote.settings', 'remote.credentials', 'remote.llm', 'remote.pluginManager'];
export function apply(ctx: Context): void {
  const scope = ctx.configForms.get<Section>(NS); let routes: readonly string[] = []; let active = true;
  const refresh = async () => { const response = await ctx.remote.llm.listProviders(); if (active && response.ok) routes = response.value.map(p => p.id); };
  void refresh().catch(() => {});
  ctx.effect(() => { const dispose = ctx.remote.$on('llm/adapters-updated', () => { void refresh().catch(() => {}); }); const reconnect = ctx.on('connection/reset', () => { void refresh().catch(() => {}); }); return () => { active = false; dispose(); reconnect(); }; });
  const operations: ClientOperations = {
    write: async (ops, revision) => { const response = await ctx.remote.settings.mutate(NS, ops, revision); if (!response.ok) throw new Error(response.error.code === 'settings/conflict' ? '配置已被其他页面修改，请关闭编辑器并重新打开' : response.error.message); return response.value; },
    credential: async ref => { const r = await ctx.remote.credentials.describe([ref]); return r.ok ? r.value[ref] : undefined; },
    storeKey: async (ref, key) => { const r = await ctx.remote.credentials.set(ref, key); if (!r.ok) throw new Error(r.error.message); },
    removeKey: async ref => { const r = await ctx.remote.credentials.unset(ref); if (!r.ok) throw new Error(r.error.message); },
    discover: async request => { const r = await ctx.remote.llm.discoverModels(NS, request); if (!r.ok) throw new Error(r.error.message); return r.value as import('../shared.js').GatewayModel[]; },
  };
  const injected = () => ({ scope, operations, taken: () => [...new Set([...routes, ...Object.keys(scope.getSnapshot().value?.providers ?? {})])], ctx });
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({ name: 'settings.models.footer', id: NS, order: 20, inject: injected }, GatewayFooter));
  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({ name: 'settings.models.provider-card', key: NS, inject: injected }, GatewayCard));
  ctx.effect(() => {
    const style = document.createElement('style'); style.dataset.plugin = 'dsh-model-gateway';
    style.textContent = `
      .dsg-section,.dsg-editor,.dsg-provider-card,.dsg-add-card,.dsg-disclosure-body,.dsg-model-catalog{display:flex;flex-direction:column;min-width:0;color:var(--dsw-alias-label-primary)}
      .dsg-section{max-width:720px;gap:12px}.dsg-section h3{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;line-height:24px;font-weight:500}.dsg-section p{margin:0;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:22px}
      .dsg-provider-card,.dsg-add-card{gap:14px;padding:14px 16px;border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform)}
      .dsg-provider-header,.dsg-provider-identity,.dsg-provider-meta,.dsg-provider-actions,.dsg-section-heading,.dsg-editor-header,.dsg-list-head,.dsg-capability,.dsg-editor-actions,.dsg-add-actions,.dsg-discovery-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dsg-provider-header,.dsg-editor-header,.dsg-list-head{justify-content:space-between}.dsg-provider-identity{gap:8px;min-width:0}.dsg-provider-name,.dsg-editor-title,.dsg-list-title{font-size:14px;line-height:22px;font-weight:500}.dsg-provider-meta{margin-top:3px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dsg-provider-summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:12px}.dsg-editor{gap:14px}.dsg-editor-route,.dsg-list-meta,.dsg-hint,.dsg-model-summary,.dsg-source{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dsg-editor-header{align-items:baseline}.dsg-disclosure-body{gap:12px;padding:10px 0 2px}.dsg-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dsg-field{display:flex;flex-direction:column;gap:6px;min-width:0}.dsg-field>span{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.dsg-model-catalog{gap:10px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l2)}.dsg-model-list,.dsg-candidates{display:flex;flex-direction:column;gap:8px}.dsg-model-entry{padding:6px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg)}.dsg-model-row{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto auto;align-items:center;gap:6px}.dsg-model-input{min-width:0}.dsg-model-summary{display:flex;gap:12px;align-items:center;padding:5px 4px 0}.dsg-model-advanced{display:grid;gap:12px;padding:8px 4px 2px}.dsg-input-types{grid-column:1/-1;margin:0;padding:0;border:0}.dsg-input-types legend{margin-bottom:4px;padding:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dsg-choice-row,.dsg-efforts{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.dsg-efforts>span{flex-basis:100%;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dsg-source{margin:0;overflow-wrap:anywhere}.dsg-source a,.dsg-editor a{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.dsg-discovery{display:flex;flex-direction:column;gap:10px}.dsg-discovery-actions{align-self:end}.dsg-candidates{max-height:280px;overflow:auto}.dsg-candidate{display:flex;align-items:center;gap:8px}.dsg-model-empty{padding:12px;border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px}.dsg-add-actions{gap:8px}.dsg-add-button{flex:1 1 0;min-width:180px;border-style:dashed}.dsg-update{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dsg-update p{flex-basis:100%}.dsg-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.dsg-editor-actions{justify-content:flex-end;padding-top:4px}
      @media(width<=560px){.dsg-fields{grid-template-columns:1fr}.dsg-model-row{grid-template-columns:minmax(0,1fr) auto auto}.dsg-model-row .dsg-model-input:nth-child(2){grid-column:1/-1;grid-row:2}.dsg-provider-summary{align-items:flex-start;flex-direction:column}.dsg-add-button{min-width:0}.dsg-model-summary{flex-wrap:wrap}}
    `;
    document.head.append(style); return () => style.remove();
  });
}
