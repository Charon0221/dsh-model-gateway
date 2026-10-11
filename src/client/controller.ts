import type { CredentialInfo, LlmDiscoveredModel, LlmModelDiscoveryRequest, SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client';
import type { GatewayModel, GatewayProfile } from '../shared.js';
import { EFFORTS, keyRefFor, NS, ROUTE_PATTERN } from '../shared.js';

export interface ClientOperations {
  write(ops: SettingsPathOpView[], revision: number): Promise<SettingsNamespaceView>;
  credential(ref: string): Promise<CredentialInfo | undefined>;
  storeKey(ref: string, key: string): Promise<void>;
  removeKey(ref: string): Promise<void>;
  discover(request: LlmModelDiscoveryRequest): Promise<readonly GatewayModel[]>;
}
/** Serialize a two-stage save. Once settings commit, retry only the key. */
export class SaveTransaction {
  committed = false;
  revision: number;
  constructor(revision: number) { this.revision = revision; }
  async save(route: string, profile: GatewayProfile, key: string, operations: ClientOperations, creating: boolean) {
    if (!this.committed) {
      // Address only editable fields so undisplayed headers/retry policies and
      // other advanced fields survive editing a redacted settings descriptor.
      const fields = ['displayName', 'baseURL', 'apiKeyEnv', 'models', 'reasoningEffort'] as const;
      const ops: SettingsPathOpView[] = creating
        ? [{ op: 'set', path: ['providers', route], value: JSON.parse(JSON.stringify(profile)) }]
        : fields.map(field => profile[field] === undefined
          ? { op: 'unset' as const, path: ['providers', route, field] }
          : { op: 'set' as const, path: ['providers', route, field], value: JSON.parse(JSON.stringify(profile[field])) });
      const view = await operations.write(ops, this.revision);
      this.revision = view.revision;
      this.committed = true;
    }
    if (key.trim()) await operations.storeKey(profile.apiKeyEnv ?? keyRefFor(route), key.trim());
  }
}
export function validateDraft(route: string, p: GatewayProfile, key: string, taken: readonly string[], creating: boolean): string | undefined {
  if (!ROUTE_PATTERN.test(route) || route === 'deepseek-official') return '提供方 ID 须以小写字母开头，仅使用小写字母、数字和连字符';
  if (creating && taken.includes(route)) return '提供方 ID 已存在';
  try {
    const url = new URL(p.baseURL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch { return '请填写有效的 HTTP(S) API 根地址'; }
  if (!p.apiKeyEnv || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p.apiKeyEnv)) return '凭据引用须是有效的环境变量名';
  if (key.trim() && (!/^[\x21-\x7e]+$/.test(key.trim()) || /^[A-Z][A-Z0-9_]*=[^=]/.test(key.trim()) || /^(["'`]).*\1$/.test(key.trim()))) return 'API Key 格式无效，请只粘贴密钥';
  if (key.length && !key.trim()) return 'API Key 不能只有空白';
  if (!p.models.length) return '至少添加一个模型';
  const ids = new Set<string>();
  for (const m of p.models) {
    if (!m.id.trim() || m.id !== m.id.trim() || ids.has(m.id)) return '模型 ID 不能为空、包含首尾空格或重复';
    ids.add(m.id);
    if (m.name !== undefined && !m.name.trim()) return '模型显示名不能为空';
    for (const value of [m.contextWindow, m.maxTokens]) if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) return '上下文和输出上限须是正整数';
    if (m.defaultTemperature !== undefined && (!Number.isFinite(m.defaultTemperature) || m.defaultTemperature < 0 || m.defaultTemperature > 2)) return 'temperature 必须在 0 到 2 之间';
    if (m.reasoningEfforts !== undefined && (!m.reasoningEfforts.length || m.reasoningEfforts.some(effort => !EFFORTS.includes(effort)))) return '推理档位配置无效';
    if (m.defaultReasoningEffort !== undefined && m.reasoningEfforts !== undefined && !m.reasoningEfforts.includes(m.defaultReasoningEffort)) return '默认推理档位必须包含在支持列表中';
  }
}
