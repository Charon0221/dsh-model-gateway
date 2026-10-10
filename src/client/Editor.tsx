import React, { useEffect, useRef, useState } from 'react';
import type { CredentialInfo, LlmDiscoveredModel } from '@deepseek-ai/dsh-api-remotes/client';
import { EFFORTS, keyRefFor, SENJIX_PRESET, type GatewayModel, type GatewayProfile } from '../shared.js';
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
  const [draft, setDraft] = useState<GatewayProfile>({ ...initial, models: initial.models.map(m => ({ ...m })), reasoningEffort: initial.reasoningEffort ?? 'high' });
  const [key, setKey] = useState('');
  const [credential, setCredential] = useState<CredentialInfo>();
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [failure, setFailure] = useState('');
  const [candidates, setCandidates] = useState<readonly LlmDiscoveredModel[]>([]);
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
  const visible = candidates.filter(m => `${m.id} ${m.name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="dsg-editor">
    <h3>{creating ? '添加第三方 DeepSeek' : `编辑 ${props.route}`}</h3>
    <div className="dsg-fields">
      <label>提供方 ID<input value={route} disabled={locked || !creating} onChange={e => setRoute(e.target.value)} placeholder="my-deepseek" /></label>
      <label>显示名称<input value={draft.displayName ?? ''} disabled={locked} onChange={e => setDraft(p => ({ ...p, displayName: e.target.value || undefined }))} /></label>
      <label>Base URL<input value={draft.baseURL} disabled={locked} onChange={e => setDraft(p => ({ ...p, baseURL: e.target.value }))} placeholder="https://gateway.example/v1" /></label>
      <label>凭据引用<input value={keyRef} disabled={locked} onChange={e => setDraft(p => ({ ...p, apiKeyEnv: e.target.value || undefined }))} /></label>
      <label>API Key<input type="password" autoComplete="off" value={key} disabled={busy || !props.writable || credential?.writable === false} onChange={e => setKey(e.target.value)} placeholder={credential?.configured ? '已配置；留空保持当前密钥' : '填写密钥或通过环境变量配置'} /></label>
      <label>默认推理强度<select value={draft.reasoningEffort ?? 'high'} disabled={locked} onChange={e => setDraft(p => ({ ...p, reasoningEffort: e.target.value as GatewayProfile['reasoningEffort'] }))}>{EFFORTS.map(e => <option key={e}>{e}</option>)}</select></label>
    </div>
    <p className="dsg-hint">推理参数使用 DeepSeek 官方协议；图片输入须由模型和网关实际支持。凭据只写入 dsh 凭据存储。</p>
    {credential?.configured && credential.writable && <div className="dsg-actions">
      {confirmKeyRemoval ? <><span>删除凭据 {keyRef}？其他使用此引用的网关也会受到影响。</span><button type="button" disabled={busy || committed || !props.writable} onClick={() => run(async () => {
        await props.operations.removeKey(keyRef);
        if (mounted.current) { setCredential(await props.operations.credential(keyRef)); setKey(''); setConfirmKeyRemoval(false); }
      })}>确认删除密钥</button><button type="button" onClick={() => setConfirmKeyRemoval(false)}>取消</button></>
        : <button type="button" disabled={locked} onClick={() => setConfirmKeyRemoval(true)}>删除已存密钥</button>}
    </div>}
    <div className="dsg-actions">
      <button type="button" disabled={locked} onClick={() => setDraft(p => ({ ...p, models: [...p.models, { id: '', inputModalities: ['text'] }] }))}>手工添加模型</button>
      <button type="button" disabled={locked || !draft.baseURL.trim()} onClick={discover}>获取可用模型</button>
    </div>
    {candidates.length > 0 && <fieldset disabled={locked} className="dsg-discovery"><legend>选择模型</legend>
      <label>搜索模型<input value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="dsg-actions"><button type="button" onClick={() => setSelected(p => new Set([...p, ...visible.map(m => m.id)]))}>全选可见</button><button type="button" onClick={() => setSelected(new Set())}>取消全选</button></div>
      <div className="dsg-candidates">{visible.map(m => <label key={m.id}><input type="checkbox" checked={selected.has(m.id)} onChange={e => setSelected(p => { const next = new Set(p); e.target.checked ? next.add(m.id) : next.delete(m.id); return next; })} />{m.id}</label>)}</div>
      <button type="button" disabled={!selected.size} onClick={() => {
        setDraft(p => ({ ...p, models: [...p.models, ...candidates.filter(m => selected.has(m.id) && !p.models.some(old => old.id === m.id)).map(m => ({ ...m, inputModalities: ['text'] as ('text' | 'image')[] }))] }));
        setCandidates([]); setSelected(new Set());
      }}>添加所选</button>
    </fieldset>}
    <div className="dsg-models">{draft.models.map((m, i) => <fieldset key={i} disabled={locked}><legend>模型 {i + 1}</legend>
      <div className="dsg-fields">
        <label>模型 ID<input value={m.id} onChange={e => modelChange(i, { id: e.target.value })} /></label>
        <label>模型显示名<input value={m.name ?? ''} onChange={e => modelChange(i, { name: e.target.value || undefined })} /></label>
        <label>上下文容量<input type="number" min="1" step="1" value={m.contextWindow ?? ''} placeholder="262144（回退值）" onChange={e => modelChange(i, { contextWindow: e.target.value ? Number(e.target.value) : undefined })} /></label>
        <label>输出上限<input type="number" min="1" step="1" value={m.maxTokens ?? ''} placeholder="32768（回退值）" onChange={e => modelChange(i, { maxTokens: e.target.value ? Number(e.target.value) : undefined })} /></label>
      </div>
      <label className="dsg-checkbox"><input type="checkbox" checked={m.inputModalities?.includes('image') ?? false} onChange={e => modelChange(i, { inputModalities: e.target.checked ? ['text', 'image'] : ['text'] })} />支持图片输入</label>
      <button type="button" onClick={() => setDraft(p => ({ ...p, models: p.models.filter((_, index) => index !== i) }))}>移除模型</button>
    </fieldset>)}</div>
    {committed && <p role="status">网关配置已保存，请重试密钥保存；配置字段已锁定。</p>}
    {(failure || validation) && <p className="dsg-error" role="alert">{failure || validation}</p>}
    <div className="dsg-actions"><button type="button" disabled={busy || !props.writable || !!validation} onClick={save}>{busy ? '处理中…' : committed ? '重试密钥保存' : '保存'}</button><button type="button" disabled={busy} onClick={props.onClose}>关闭</button></div>
  </div>;
}
