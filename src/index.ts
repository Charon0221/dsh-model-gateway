import type { Context } from '@deepseek-ai/cordis';
import {
  LlmError, assertUsableApiKey, resolveImageAttachmentAccess,
  type AdapterRegistrationHandle, type DirectoryRegistrationHandle,
} from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-settings';
import type {} from '@deepseek-ai/dsh-credentials';
import type {} from '@deepseek-ai/dsh-attachment';
import type {} from '@deepseek-ai/dsh-fs';
import type {} from '@deepseek-ai/dsh-web';
import type {} from '@deepseek-ai/cordis-plugin-loader';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { GatewayAdapter } from './adapter.js';
import { Config, resolveProfiles, type ResolvedProfile, type LiveConfig } from './config.js';
import { discoverModels } from './discovery.js';
import { NS } from './shared.js';
import { GatewayWebSearchProvider } from './web.js';

export { Config, resolveProfiles, GatewayAdapter, discoverModels };
export type { GatewayModel, GatewayProfile, Effort, NativeSearchMode } from './shared.js';
export const name = NS;
export const inject = ['llm', 'web'];

export function apply(ctx: Context, config: LiveConfig): void {
  const source = (): import('./config.js').Config => ({ providers: config.providers.get() as import('./config.js').Config['providers'] });
  let raw = source();
  let profiles = resolveProfiles(raw);
  let registration: AdapterRegistrationHandle | undefined;
  let directory: DirectoryRegistrationHandle | undefined;
  let synchronizing = false;
  let rejected: Config | undefined;
  const key = async (p: ResolvedProfile) => {
    const credentials = ctx.get('credentials');
    const value = (credentials ? (await credentials.resolve(p.apiKeyEnv))?.value : undefined) ?? launchEnvironmentOf(ctx).get(p.apiKeyEnv)?.value;
    if (!value) throw new LlmError(`${p.route}: 未配置凭据 ${p.apiKeyEnv}`, 'MISSING_CREDENTIAL');
    return assertUsableApiKey(value, NS, p.apiKeyEnv);
  };
  const synchronize = () => {
    const nextRaw = source();
    if (raw.providers === nextRaw.providers && registration) return;
    const next = resolveProfiles(nextRaw);
    const owned = new Set(profiles.keys());
    const taken = ctx.llm.listProviders().filter(p => !owned.has(p.id));
    const declared = ctx.llm.listConfigurableProviders().filter(p => p.settingsNs !== NS);
    if ([...next.keys()].some(id => taken.some(p => p.id === id) || declared.some(p => p.provider === id))) throw new LlmError('提供方 ID 已被其他适配器占用', 'DUPLICATE_ADAPTER');
    const previous = profiles;
    // adapter metadata must read the candidate while the registry validates it.
    profiles = next;
    synchronizing = true;
    try {
      const routes = [...next.keys()];
      const entries = routes.map(provider => ({ provider, displayName: next.get(provider)!.displayName, settingsNs: NS, settingsPath: ['providers', provider], declared: true }));
      if (registration) registration.replace(routes);
      else if (routes.length) registration = ctx.llm.registerAdapter(routes, adapter);
      if (directory) directory.replace(entries);
      else if (entries.length) directory = ctx.llm.registerConfigurableProviders(entries);
      raw = nextRaw;
    } catch (error) {
      profiles = previous;
      registration?.replace([...previous.keys()]);
      directory?.replace([...previous.values()].map(p => ({ provider: p.route, displayName: p.displayName, settingsNs: NS, settingsPath: ['providers', p.route], declared: true })));
      throw error;
    } finally { synchronizing = false; }
  };
  const current = () => {
    if (!synchronizing && raw.providers !== source().providers && rejected?.providers !== source().providers) {
      try { synchronize(); } catch { rejected = source(); ctx.logger.warn('第三方 DeepSeek 配置未生效，保留最后有效网关配置'); }
    }
    return profiles;
  };
  ctx.on('internal/config', function (_candidate, next) {
    const candidate = next();
    if (this !== ctx.fiber) return candidate;
    const validated = Config(candidate);
    const parsed = resolveProfiles({ providers: validated.providers.get() as import('./config.js').Config['providers'] });
    const owned = new Set(profiles.keys());
    const taken = ctx.llm.listProviders().filter(p => !owned.has(p.id));
    const declared = ctx.llm.listConfigurableProviders().filter(p => p.settingsNs !== NS);
    if ([...parsed.keys()].some(id => taken.some(p => p.id === id) || declared.some(p => p.provider === id))) throw new LlmError('提供方 ID 已被其他适配器占用', 'DUPLICATE_ADAPTER');
    return candidate;
  });
  const adapter = new GatewayAdapter({
    profiles: current, resolveApiKey: key,
    serializationServices: () => {
      const attachments = ctx.get('attachments');
      const fs = ctx.get('fs');
      return {
        attachments,
        resolveImageAccess: attachments ? ref => resolveImageAttachmentAccess(attachments, path => fs?.processPathFromHostPath(path), ref) : undefined,
        resolveFilePath: path => fs?.processPathFromHostPath(path),
      };
    },
  });
  (ctx as any).get?.('web')?.registerSearchProvider(new GatewayWebSearchProvider(current, key, () => {
    const agents = (ctx as any).get?.('agents');
    return agents?.currentInitiator?.()?.session?.requestContext?.()?.provider;
  }));
  synchronize();
  ctx.llm.registerModelDiscovery(NS, (request, signal) => discoverModels(request, current(), key, signal));
  ctx.on('loader/volatile-update', () => { current(); });
  ctx.inject(['settings'], settingsCtx => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber));
  });
}
