import z from '@deepseek-ai/schemastery';
import { credentialRef, type CredentialRef } from '@deepseek-ai/dsh-credentials';
import { LlmError, RetryPolicySchema, resolveRetryPolicy, type ResolvedRetryPolicy } from '@deepseek-ai/dsh-llm';
import { EFFORTS, PROTOCOLS, keyRefFor, ROUTE_PATTERN, type Effort, type GatewayModel, type GatewayProfile, type GatewayProtocol } from './shared.js';
import { enrichModel } from './catalog.js';

export interface Config { providers?: Record<string, GatewayProfile> }
const positiveInteger = () => z.number().min(1).step(1);
export const ModelSchema: z<GatewayModel> = z.object({
  id: z.string().required(), name: z.string(), description: z.string(),
  contextWindow: positiveInteger(), maxTokens: positiveInteger(),
  inputModalities: z.array(z.union(['text', 'image'])),
  providerFamily: z.union(['deepseek', 'openai', 'anthropic', 'xai']),
  reasoningEfforts: z.array(z.union([...EFFORTS])), defaultReasoningEffort: z.union([...EFFORTS]),
  supportsTools: z.boolean(), defaultTemperature: z.number().min(0).max(2),
  imagePixelBudget: z.union([positiveInteger(), z.const('low')]),
  imageMaxBytes: positiveInteger(),
});
export const ProfileSchema: z<GatewayProfile> = z.object({
  displayName: z.string(), baseURL: z.string().required(), protocol: z.union([...PROTOCOLS]), apiKeyEnv: z.string(),
  headers: z.dict(z.string()).role('secret'), models: z.array(ModelSchema).required(),
  reasoningEffort: z.union([...EFFORTS]), defaultContextWindow: positiveInteger(),
  maxTokens: positiveInteger(), streamIdleTimeoutMs: positiveInteger().max(2147483647),
  maxInlineRequestImageBytes: positiveInteger(), maxImagesPerRequest: positiveInteger(),
  retryPolicy: RetryPolicySchema,
});
// Form schemas cross the Remote boundary: callbacks cannot be rehydrated there.
// Semantic validation belongs to the Host internal/config hook before commit.
export const Config = z.object({ providers: z.dict(ProfileSchema).default({}).volatile() }).default({});
export type LiveConfig = ReturnType<typeof Config>;
export interface ResolvedProfile extends Omit<GatewayProfile, 'apiKeyEnv' | 'retryPolicy'> {
  route: string;
  displayName: string;
  apiKeyEnv: CredentialRef;
  reasoningEffort: Effort;
  defaultContextWindow: number;
  maxTokens: number;
  streamIdleTimeoutMs: number;
  maxInlineRequestImageBytes: number;
  maxImagesPerRequest: number;
  retryPolicy: ResolvedRetryPolicy;
}

export function apiBaseURL(input: string): string {
  try {
    const url = new URL(input.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    return url.toString().replace(/\/+$/, '');
  } catch { throw new LlmError('Base URL 必须是无用户名、密码、查询参数和片段的 HTTP(S) API 根地址', 'INVALID_CONFIG'); }
}

export function resolveProfiles(config: Config): ReadonlyMap<string, ResolvedProfile> {
  const result = new Map<string, ResolvedProfile>();
  const number = (value: number | undefined, fallback: number, path: string) => {
    const n = value ?? fallback;
    if (!Number.isSafeInteger(n) || n <= 0) throw new LlmError(`${path} 必须是正整数`, 'INVALID_CONFIG');
    return n;
  };
  for (const [route, raw] of Object.entries(config.providers ?? {})) {
    if (!ROUTE_PATTERN.test(route) || route === 'deepseek-official') throw new LlmError('提供方 ID 必须是小写连字符标识符，且不能占用 deepseek-official', 'INVALID_CONFIG');
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.models) || !raw.models.length) throw new LlmError(`${route}: 至少配置一个模型`, 'INVALID_CONFIG');
    const seen = new Set<string>();
    const models = raw.models.map((m) => {
      if (typeof m.id !== 'string' || !m.id.trim() || m.id !== m.id.trim() || seen.has(m.id)) throw new LlmError(`${route}: 模型 ID 不能为空或重复`, 'INVALID_CONFIG');
      seen.add(m.id);
      if (m.name !== undefined && !m.name.trim()) throw new LlmError(`${route}/${m.id}: 显示名不能为空`, 'INVALID_CONFIG');
      for (const key of ['contextWindow', 'maxTokens', 'imageMaxBytes'] as const) if (m[key] !== undefined) number(m[key], 1, `${route}/${m.id}.${key}`);
      if (m.imagePixelBudget !== undefined && m.imagePixelBudget !== 'low') number(m.imagePixelBudget, 1, `${route}/${m.id}.imagePixelBudget`);
      const input = m.inputModalities?.length ? m.inputModalities : undefined;
      if (input && (!input.includes('text') || input.some(v => v !== 'text' && v !== 'image'))) throw new LlmError(`${route}/${m.id}: 输入类型须包含 text，图片能力使用 image`, 'INVALID_CONFIG');
      const enriched = enrichModel({ ...m, ...(input ? { inputModalities: [...input] } : {}) });
      const efforts = enriched.reasoningEfforts ?? [...EFFORTS];
      if (!efforts.length || efforts.some(e => !EFFORTS.includes(e))) throw new LlmError(`${route}/${m.id}: 推理档位无效`, 'INVALID_CONFIG');
      if (!efforts.includes(enriched.defaultReasoningEffort ?? 'high')) throw new LlmError(`${route}/${m.id}: 默认推理档位不在支持列表中`, 'INVALID_CONFIG');
      if (enriched.defaultTemperature !== undefined && (!Number.isFinite(enriched.defaultTemperature) || enriched.defaultTemperature < 0 || enriched.defaultTemperature > 2)) throw new LlmError(`${route}/${m.id}: 默认 temperature 必须在 0 到 2 之间`, 'INVALID_CONFIG');
      return Object.freeze({ ...enriched, inputModalities: Object.freeze([...(enriched.inputModalities ?? ['text'])]) as unknown as ('text' | 'image')[], reasoningEfforts: Object.freeze([...efforts]) as unknown as Effort[] });
    });
    const effort = raw.reasoningEffort ?? 'high';
    if (!EFFORTS.includes(effort)) throw new LlmError(`${route}: 不支持的推理强度`, 'INVALID_CONFIG');
    if (raw.apiKeyEnv !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.apiKeyEnv)) throw new LlmError(`${route}: 凭据引用须是有效环境变量名`, 'INVALID_CONFIG');
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(raw.headers ?? {})) {
      if (/^(authorization|proxy-authorization|content-type|accept|host|cookie|set-cookie|x-deepseek-harness-.*)$/i.test(name)) throw new LlmError(`${route}: 不允许覆盖鉴权、协议或 harness 归因标头`, 'INVALID_CONFIG');
      try { new Headers({ [name]: value }); } catch { throw new LlmError(`${route}: 请求头格式无效`, 'INVALID_CONFIG'); }
      headers[name] = value;
    }
    const profile: ResolvedProfile = {
      ...raw, route, displayName: raw.displayName?.trim() || route,
      protocol: (raw.protocol ?? 'chat-completions') as GatewayProtocol,
      baseURL: apiBaseURL(raw.baseURL), apiKeyEnv: credentialRef(raw.apiKeyEnv ?? keyRefFor(route)),
      headers: Object.freeze(headers), models: Object.freeze(models) as unknown as GatewayModel[],
      reasoningEffort: effort,
      defaultContextWindow: number(raw.defaultContextWindow, 262144, `${route}.defaultContextWindow`),
      maxTokens: number(raw.maxTokens, 32768, `${route}.maxTokens`),
      streamIdleTimeoutMs: number(raw.streamIdleTimeoutMs, 300000, `${route}.streamIdleTimeoutMs`),
      maxInlineRequestImageBytes: number(raw.maxInlineRequestImageBytes, 20 * 1024 * 1024, `${route}.maxInlineRequestImageBytes`),
      maxImagesPerRequest: number(raw.maxImagesPerRequest, 600, `${route}.maxImagesPerRequest`),
      retryPolicy: resolveRetryPolicy(raw.retryPolicy, route),
    };
    if (profile.streamIdleTimeoutMs > 2147483647) throw new LlmError(`${route}: 空闲超时超出计时器范围`, 'INVALID_CONFIG');
    result.set(route, Object.freeze(profile));
  }
  return result;
}
