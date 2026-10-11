import React, { useEffect, useRef, useState } from 'react';
import type { CredentialInfo } from '@deepseek-ai/dsh-api-remotes/client';
import { EFFORTS, PROTOCOLS, keyRefFor, SENJIX_PRESET, type Effort, type GatewayModel, type GatewayProfile, type GatewayProtocol } from '../shared.js';
import { OFFICIAL_MODEL_CATALOG } from '../catalog.js';
import { SaveTransaction, validateDraft, type ClientOperations } from './controller.js';

export interface EditorProps {
  route?: string;
  initial?: GatewayProfile;
  preset?: boolean;
  revision: number;
  taken: readonly string[];
  writable: boolean;
  operations: ClientOperations;
  onClose: () => void;
}
export function GatewayEditor(props: EditorProps) {
  const creating = !props.route;
  const initial: GatewayProfile = props.initial ?? (props.preset ? { displayName: SENJIX_PRESET.displayName, baseURL: SENJIX_PRESET.baseURL, apiKeyEnv: SENJIX_PRESET.apiKeyEnv, models: SENJIX_PRESET.models } : { baseURL: '', models: [] });
  const [route, setRoute] = useState(props.route ?? (props.preset ? 'senjix' : ''));
  const [draft, setDraft] = useState<GatewayProfile>({ ...initial, models: initial.models.map(m => ({ ...m })), protocol: initial.protocol ?? 'chat-completions', reasoningEffort: initial.reasoningEffort ?? 'high' });
  const [key, setKey] = useState('');
  const [credential, setCredential] = useState<CredentialInfo>();
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [failure, setFailure] = useState('');
  const [candidates, setCandidates] = useState<readonly GatewayModel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [confirmKeyRemoval, setConfirmKeyRemoval] = useState(false);
  const transaction = useRef(new SaveTransaction(props.revision));
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const keyRef = draft.apiKeyEnv ?? keyRefFor(route || 'gateway');
  const profile: GatewayProfile = { ...draft, apiKeyEnv: keyRef };
  const validation = validateDraft(route, profile, key, props.taken, creating && !committed);
  const locked = busy || committed || !props.writable;
  useEffect(() => {
    let current = true;
    setCredential(undefined);
    props.operations.credential(keyRef).then(value => { if (current) setCredential(value); }).catch(() => {});
    return () => { current = false; };
  }, [keyRef, props.operations]);
  const modelChange = (index: number, patch: Partial<GatewayModel>) => setDraft(p => ({ ...p, models: p.models.map((m, i) => i === index ? { ...m, ...patch } : m) }));
  const toggleEffort = (index: number, effort: Effort, checked: boolean) => setDraft(p => ({ ...p, models: p.models.map((m, i) => {
    if (i !== index) return m;
    const efforts = new Set(m.reasoningEfforts ?? EFFORTS);
    checked ? efforts.add(effort) : efforts.delete(effort);
    const next = EFFORTS.filter(value => efforts.has(value));
    return { ...m, reasoningEfforts: next.length ? next : ['off'], defaultReasoningEffort: next.includes(m.defaultReasoningEffort ?? 'high') ? m.defaultReasoningEffort : next[0] };
  }) }));
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setFailure('');
    try { await fn(); } catch (error) { if (mounted.current) setFailure(error instanceof Error ? error.message : '操作失败'); }
    finally { if (mounted.current) setBusy(false); }
  };
  const save = () => run(async () => {
    try {
      await transaction.current.save(route, profile, key, props.operations, creating);
      if (mounted.current) { setKey(''); props.onClose(); }
    } finally { if (mounted.current) setCommitted(transaction.current.committed); }
  });
  const discover = () => run(async () => {
    const result = await props.operations.discover({ provider: props.route, baseURL: draft.baseURL, ...(key.trim() ? { apiKey: key.trim() } : {}) });
    if (mounted.current) { setCandidates(result); setSelected(new Set()); if (!result.length) setFailure('网关未公布模型，请手工添加'); }
  });
  const loadOfficialPresets = () => {
    const existing = new Set(draft.models.map(model => model.id));
    setCandidates(OFFICIAL_MODEL_CATALOG.filter(model => !existing.has(model.id)).map(model => ({ ...model, inputModalities: [...model.inputModalities], reasoningEfforts: [...model.reasoningEfforts] })));
    setSelected(new Set());
    setQuery('');
    setFailure('');
  };
  const visible = candidates.filter(m => `${m.id} ${m.name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="dsg-editor">
    <header className="dsg-editor-header">
      <div><h3 className="dsg-editor-title">{creating ? '添加模型网关' : '编辑网关'}</h3><span className="dsg-editor-route">{route || '新网关'}</span></div>
    </header>
    <div className="dsg-fields dsg-fields-primary">
      <label className="dsg-field"><span>提供方 ID</span><input value={route} disabled={locked || !creating} onChange={e => setRoute(e.target.value)} placeholder="my-deepseek" /></label>
      <label className="dsg-field"><span>显示名称</span><input value={draft.displayName ?? ''} disabled={locked} onChange={e => setDraft(p => ({ ...p, displayName: e.target.value || undefined }))} /></label>
      <label className="dsg-field"><span>API 协议</span><select value={draft.protocol ?? 'chat-completions'} disabled={locked} onChange={e => setDraft(p => ({ ...p, protocol: e.target.value as GatewayProtocol }))}>{PROTOCOLS.map(protocol => <option key={protocol} value={protocol}>{protocol === 'chat-completions' ? 'OpenAI Chat Completions' : protocol === 'responses' ? 'OpenAI Responses' : 'Anthropic Messages'}</option>)}</select></label>
      <label className="dsg-field dsg-field-wide"><span>Base URL</span><input value={draft.baseURL} disabled={locked} onChange={e => setDraft(p => ({ ...p, baseURL: e.target.value }))} placeholder="https://gateway.example/v1" /></label>
      <label className="dsg-field"><span>凭据引用</span><input value={keyRef} disabled={locked} onChange={e => setDraft(p => ({ ...p, apiKeyEnv: e.target.value || undefined }))} /></label>
      <label className="dsg-field"><span>API Key</span><input type="password" autoComplete="off" value={key} disabled={busy || !props.writable || credential?.writable === false} onChange={e => setKey(e.target.value)} placeholder={credential?.configured ? '已配置；留空保持当前密钥' : '填写密钥或通过环境变量配置'} /></label>
      <label className="dsg-field"><span>默认推理强度</span><select value={draft.reasoningEffort ?? 'high'} disabled={locked} onChange={e => setDraft(p => ({ ...p, reasoningEffort: e.target.value as GatewayProfile['reasoningEffort'] }))}>{EFFORTS.map(e => <option key={e}>{e}</option>)}</select></label>
    </div>
    <p className="dsg-hint">推理参数使用 DeepSeek 官方协议；图片输入须由模型和网关实际支持。凭据只写入 dsh 凭据存储。</p>
    {credential?.configured && credential.writable && <div className="dsg-inline-warning">
      {confirmKeyRemoval ? <><span>删除凭据 {keyRef}？其他使用此引用的网关也会受到影响。</span><button className="dsg-button dsg-button-danger" type="button" disabled={busy || committed || !props.writable} onClick={() => run(async () => {
        await props.operations.removeKey(keyRef);
        if (mounted.current) { setCredential(await props.operations.credential(keyRef)); setKey(''); setConfirmKeyRemoval(false); }
      })}>确认删除密钥</button><button className="dsg-button dsg-button-quiet" type="button" onClick={() => setConfirmKeyRemoval(false)}>取消</button></>
        : <button className="dsg-button dsg-button-danger" type="button" disabled={locked} onClick={() => setConfirmKeyRemoval(true)}>删除已存密钥</button>}
    </div>}
    <div className="dsg-section-heading"><div><h4>模型能力</h4><p>显式声明模型支持的输入类型和容量。</p></div><div className="dsg-actions dsg-actions-compact">
      <button className="dsg-button dsg-button-secondary" type="button" disabled={locked} onClick={() => setDraft(p => ({ ...p, models: [...p.models, { id: '', inputModalities: ['text'] }] }))}>手工添加模型</button>
      <button className="dsg-button dsg-button-secondary" type="button" disabled={locked} onClick={loadOfficialPresets}>添加官方预设</button>
      <button className="dsg-button dsg-button-secondary" type="button" disabled={locked || !draft.baseURL.trim()} onClick={discover}>获取深极云算模型</button>
    </div>
    </div>
    {candidates.length > 0 && <fieldset disabled={locked} className="dsg-discovery"><legend>选择模型</legend>
      <div className="dsg-discovery-toolbar"><label className="dsg-field"><span>搜索模型</span><input value={query} onChange={e => setQuery(e.target.value)} /></label><div className="dsg-actions dsg-actions-compact"><button className="dsg-button dsg-button-quiet" type="button" onClick={() => setSelected(p => new Set([...p, ...visible.map(m => m.id)]))}>全选可见</button><button className="dsg-button dsg-button-quiet" type="button" onClick={() => setSelected(new Set())}>取消全选</button></div></div>
      <div className="dsg-candidates">{visible.length ? visible.map(m => <label key={m.id}><input type="checkbox" checked={selected.has(m.id)} onChange={e => setSelected(p => { const next = new Set(p); e.target.checked ? next.add(m.id) : next.delete(m.id); return next; })} /><code>{m.id}</code><span className="dsg-candidate-meta">{m.name ?? '未知模型'} · {m.contextWindow ? `${m.contextWindow.toLocaleString()} 上下文` : '默认容量'} · {m.inputModalities?.includes('image') ? '图片' : '文本'}</span></label>) : <p className="dsg-empty">没有匹配的模型</p>}</div>
      <button className="dsg-button dsg-button-primary" type="button" disabled={!selected.size} onClick={() => {
        setDraft(p => ({ ...p, models: [...p.models, ...candidates.filter(m => selected.has(m.id) && !p.models.some(old => old.id === m.id)).map(m => ({ ...m }))] }));
        setCandidates([]); setSelected(new Set());
      }}>添加所选</button>
    </fieldset>}
    <div className="dsg-models">{draft.models.length ? draft.models.map((m, i) => <fieldset key={i} disabled={locked} className="dsg-model-card"><legend>模型 {i + 1}</legend>
      <div className="dsg-fields dsg-model-fields">
        <label className="dsg-field"><span>模型 ID</span><input value={m.id} onChange={e => modelChange(i, { id: e.target.value })} /></label>
        <label className="dsg-field"><span>模型显示名</span><input value={m.name ?? ''} onChange={e => modelChange(i, { name: e.target.value || undefined })} /></label>
        <label className="dsg-field"><span>上下文容量</span><input type="number" min="1" step="1" value={m.contextWindow ?? ''} placeholder="262144（回退值）" onChange={e => modelChange(i, { contextWindow: e.target.value ? Number(e.target.value) : undefined })} /></label>
        <label className="dsg-field"><span>输出上限</span><input type="number" min="1" step="1" value={m.maxTokens ?? ''} placeholder="32768（回退值）" onChange={e => modelChange(i, { maxTokens: e.target.value ? Number(e.target.value) : undefined })} /></label>
      </div>
      <label className="dsg-checkbox"><input type="checkbox" checked={m.inputModalities?.includes('image') ?? false} onChange={e => modelChange(i, { inputModalities: e.target.checked ? ['text', 'image'] : ['text'] })} />支持图片输入</label>
      <div className="dsg-model-options"><label className="dsg-checkbox"><input type="checkbox" checked={m.supportsTools !== false} onChange={e => modelChange(i, { supportsTools: e.target.checked })} />支持工具调用</label><label className="dsg-field dsg-field-inline"><span>默认 temperature</span><input type="number" min="0" max="2" step="0.1" value={m.defaultTemperature ?? ''} placeholder="按官方默认" onChange={e => modelChange(i, { defaultTemperature: e.target.value ? Number(e.target.value) : undefined })} /></label></div>
      <div className="dsg-efforts"><span className="dsg-field-label">支持的推理档位</span>{EFFORTS.map(effort => <label key={effort} className="dsg-checkbox"><input type="checkbox" checked={(m.reasoningEfforts ?? EFFORTS).includes(effort)} onChange={e => toggleEffort(i, effort, e.target.checked)} />{effort}</label>)}<label className="dsg-field dsg-field-inline"><span>默认档位</span><select value={m.defaultReasoningEffort ?? 'high'} onChange={e => modelChange(i, { defaultReasoningEffort: e.target.value as Effort })}>{(m.reasoningEfforts ?? EFFORTS).map(effort => <option key={effort}>{effort}</option>)}</select></label></div>
      <button className="dsg-button dsg-button-danger dsg-button-small" type="button" onClick={() => setDraft(p => ({ ...p, models: p.models.filter((_, index) => index !== i) }))}>移除模型</button>
    </fieldset>) : <p className="dsg-empty dsg-empty-models">还没有模型，请手工添加或获取网关模型列表。</p>}</div>
    {committed && <p className="dsg-success" role="status">网关配置已保存，请重试密钥保存；配置字段已锁定。</p>}
    {(failure || validation) && <p className="dsg-error" role="alert">{failure || validation}</p>}
    <div className="dsg-actions dsg-editor-actions"><button className="dsg-button dsg-button-primary" type="button" disabled={busy || !props.writable || !!validation} onClick={save}>{busy ? '处理中…' : committed ? '重试密钥保存' : '保存'}</button><button className="dsg-button dsg-button-secondary" type="button" disabled={busy} onClick={props.onClose}>关闭</button></div>
  </div>;
}
