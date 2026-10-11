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
interface Injected { scope: ConfigForm<Section>; operations: ClientOperations; taken: () => readonly string[] }
function useSnapshot(scope: ConfigForm<Section>) { return useSyncExternalStore(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope), scope.getSnapshot.bind(scope)); }
export function GatewayFooter({ scope, operations, taken }: Injected) {
  const state = useSnapshot(scope);
  const [open, setOpen] = useState<'custom' | 'senjix'>();
  const [update, setUpdate] = useState<PluginUpdateInfo | null>();
  const [copied, setCopied] = useState(false);
  useEffect(() => { let active = true; void checkForUpdate().then(value => { if (active) setUpdate(value); }); return () => { active = false; }; }, []);
  const copyInstallSpec = async () => {
    if (!update || !navigator.clipboard) return;
    try { await navigator.clipboard.writeText(update.installSpec); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard permission is optional */ }
  };
  if (state.status !== 'ready') return null;
  return <section className="dsg-section" aria-label="第三方模型网关">
    <div className="dsg-section-heading"><div><h3>第三方模型网关</h3><p>连接深极云算提供的模型，可选择 OpenAI Chat Completions、OpenAI Responses 或 Anthropic Messages 协议。</p></div></div>
    {update && <div className="dsg-update" role="status"><span>发现新版本 v{update.latestVersion}（当前 v{PLUGIN_VERSION}）。</span><a href={update.releaseUrl} target="_blank" rel="noreferrer">查看发布说明</a><button className="dsg-button dsg-button-quiet dsg-button-small" type="button" onClick={copyInstallSpec}>{copied ? '已复制安装地址' : '复制安装地址'}</button><p>请在 DSH 设置 → 插件中卸载旧版后安装新版本；升级需要按桌面端提示重启。</p></div>}
    {open ? <GatewayEditor revision={state.revision!} taken={taken()} writable={state.writable} preset={open === 'senjix'} operations={operations} onClose={() => setOpen(undefined)} />
      : <div className="dsg-add-actions"><button className="dsg-button dsg-button-add" type="button" disabled={!state.writable} onClick={() => setOpen('custom')}>添加模型网关</button><button className="dsg-button dsg-button-link" type="button" disabled={!state.writable} onClick={() => setOpen('senjix')}>使用深极云算预填</button></div>}
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
    <div className="dsg-card-header"><div className="dsg-card-identity"><span className={`dsg-status-dot ${credential?.configured ? 'dsg-status-dot-ok' : 'dsg-status-dot-missing'}`} aria-label={credential?.configured ? 'API 密钥已配置' : 'API 密钥缺失'} /><div><strong>{profile.displayName ?? route}</strong><span className="dsg-route-tag">{route}</span></div></div><span className="dsg-card-meta">{profile.models.length} 个模型</span></div>
    {open ? <GatewayEditor key={route} route={route} initial={profile} revision={state.revision!} taken={taken()} writable={state.writable} operations={operations} onClose={() => setOpen(false)} />
      : <div className="dsg-actions dsg-card-actions"><button className="dsg-button dsg-button-secondary" type="button" onClick={() => setOpen(true)}>编辑网关与模型能力</button><button className="dsg-button dsg-button-danger" type="button" disabled={!state.writable || busy || fromBase} onClick={() => setConfirmDelete(true)}>删除本网关</button></div>}
    {confirmDelete && <div className="dsg-confirm" role="alertdialog" aria-label={`删除 ${route}`}><p>确认删除网关 {route}？凭据保留在 dsh 中；如需删除密钥，请先在网关编辑器中操作。</p><div className="dsg-actions"><button className="dsg-button dsg-button-danger" type="button" disabled={busy} onClick={remove}>确认删除</button><button className="dsg-button dsg-button-quiet" type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button></div></div>}
    {fromBase && <p className="dsg-hint dsg-card-hint">该网关来自组合配置；请在对应 patch 中移除。</p>}
    {failure && <p role="alert" className="dsg-error">{failure}</p>}
  </div>;
}
export const inject = ['slots', 'configForms', 'remote', 'remote.settings', 'remote.credentials', 'remote.llm'];
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
  const injected = () => ({ scope, operations, taken: () => [...new Set([...routes, ...Object.keys(scope.getSnapshot().value?.providers ?? {})])] });
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({ name: 'settings.models.footer', id: NS, order: 20, inject: injected }, GatewayFooter));
  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({ name: 'settings.models.provider-card', key: NS, inject: injected }, GatewayCard));
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-model-gateway';
    style.textContent = `
      .dsg-section{max-width:720px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:12px}
      .dsg-section h3,.dsg-editor h3{margin:0;font-size:16px;font-weight:500;line-height:24px}
      .dsg-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .dsg-section-heading p,.dsg-section-heading h4{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
      .dsg-section-heading h4{color:var(--dsw-alias-label-secondary);font-weight:500}
      .dsg-add-actions{display:flex;flex-direction:column;align-items:stretch;gap:8px}
      .dsg-card,.dsg-editor{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-settings-card-fill);padding:14px 16px;display:flex;flex-direction:column;gap:12px}
      .dsg-editor{background:var(--dsw-alias-bg-module-platform);border:0;padding:14px 16px;gap:14px}
      .dsg-card-header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
      .dsg-card-identity{display:flex;align-items:center;gap:8px;min-width:0}.dsg-card-identity>div{display:flex;align-items:center;gap:7px;min-width:0}
      .dsg-card-identity strong{font-size:14px;font-weight:500;line-height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsg-card-meta,.dsg-editor-route{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}
      .dsg-route-tag{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);color:var(--dsw-alias-label-secondary);padding:1px 6px;font-size:11px;line-height:16px;white-space:nowrap}.dsg-status-dot{width:8px;height:8px;border-radius:50%;flex:none}.dsg-status-dot-ok{background:var(--dsw-alias-state-success-primary)}.dsg-status-dot-missing{background:var(--dsw-alias-state-error-primary)}
      .dsg-editor-header{display:flex;align-items:baseline;gap:8px}.dsg-editor-title{color:var(--dsw-alias-label-primary)}
      .dsg-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dsg-field{display:flex;flex-direction:column;gap:6px;min-width:0}.dsg-field>span{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.dsg-field-wide{grid-column:1/-1}
      .dsg-editor input:not([type=checkbox]),.dsg-editor select{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);width:100%;height:32px;font:inherit;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font-size:14px;line-height:22px}.dsg-editor select{cursor:pointer}.dsg-editor input:focus,.dsg-editor select:focus{border-color:var(--dsw-alias-state-business-primary);outline:none}.dsg-editor input:focus-visible,.dsg-editor select:focus-visible,.dsg-button:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}.dsg-editor input::placeholder{color:var(--dsw-alias-label-dimmed)}.dsg-editor input:disabled,.dsg-editor select:disabled{opacity:.6;cursor:default}
      .dsg-button{box-sizing:border-box;border-radius:var(--dsw-radius-md);height:36px;font:inherit;font-size:14px;line-height:22px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 14px}.dsg-button:disabled{opacity:.4;cursor:default}.dsg-button-primary{border:0;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.dsg-button-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.dsg-button-secondary,.dsg-button-add{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);background:transparent}.dsg-button-secondary:hover:not(:disabled),.dsg-button-add:hover:not(:disabled),.dsg-button-quiet:hover:not(:disabled),.dsg-button-link:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsg-button-danger{border:0;color:var(--dsw-alias-state-error-primary);background:transparent}.dsg-button-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.dsg-button-quiet,.dsg-button-link{border:0;color:var(--dsw-alias-label-tertiary);background:transparent}.dsg-button-add{border-style:dashed;border-radius:var(--dsw-radius-lg);height:44px}.dsg-button-small{height:28px;border-radius:var(--dsw-radius-sm);padding:0 10px;font-size:12px;line-height:18px;align-self:flex-start}
      .dsg-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0}.dsg-actions-compact{gap:4px}.dsg-card-actions{padding-top:2px}.dsg-editor-actions{justify-content:flex-end;padding-top:4px}.dsg-inline-warning,.dsg-confirm{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:10px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;line-height:18px}.dsg-confirm{border:0;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);padding:10px 12px}.dsg-confirm p{margin:0;flex:1 1 100%}.dsg-hint,.dsg-error,.dsg-success{margin:0;font-size:12px;line-height:18px}.dsg-hint{color:var(--dsw-alias-label-tertiary)}.dsg-card-hint{padding-top:2px}.dsg-error{color:var(--dsw-alias-state-error-primary)}.dsg-success{color:var(--dsw-alias-state-success-primary)}
      .dsg-update{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);padding:8px 10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dsg-update a{color:var(--dsw-alias-label-primary);text-decoration:underline;text-underline-offset:2px}.dsg-update p{flex-basis:100%;margin:0;color:var(--dsw-alias-label-tertiary)}
      .dsg-models{display:flex;flex-direction:column;gap:8px}.dsg-model-card,.dsg-discovery{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);margin:0;padding:10px 12px;background:transparent}.dsg-model-card legend,.dsg-discovery legend{color:var(--dsw-alias-label-secondary);padding:0 4px;font-size:12px;font-weight:500;line-height:18px}.dsg-model-fields{gap:8px}.dsg-checkbox{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dsg-empty{border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);color:var(--dsw-alias-label-tertiary);text-align:center;margin:0;padding:12px;font-size:12px;line-height:18px}.dsg-empty-models{margin-top:2px}
      .dsg-discovery{display:flex;flex-direction:column;gap:10px}.dsg-discovery-toolbar{display:flex;align-items:flex-end;gap:8px}.dsg-discovery-toolbar .dsg-field{flex:1}.dsg-candidates{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow-y:auto}.dsg-candidates label{display:flex;align-items:center;gap:8px;border-radius:var(--dsw-radius-sm);padding:6px 8px;cursor:pointer;font-size:13px}.dsg-candidates label:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsg-candidates code{font-family:var(--ds-font-family-code);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsg-candidate-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsg-model-options,.dsg-efforts{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dsg-field-inline{flex-direction:row;align-items:center;gap:6px}.dsg-field-inline input,.dsg-field-inline select{width:120px}.dsg-field-label{color:var(--dsw-alias-label-secondary);font-size:12px}
      @media (width<=560px){.dsg-fields{grid-template-columns:1fr}.dsg-field-wide{grid-column:auto}.dsg-card-header,.dsg-section-heading,.dsg-discovery-toolbar{align-items:stretch;flex-direction:column}.dsg-card-meta{white-space:normal}.dsg-editor-actions .dsg-button{flex:1}.dsg-discovery-toolbar .dsg-actions{justify-content:flex-start}}
      @media (prefers-reduced-motion:reduce){.dsg-button{transition:none}}
    `;
    document.head.append(style);
    return () => style.remove();
  });
}
