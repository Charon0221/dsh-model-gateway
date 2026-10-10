import type { Context } from '@deepseek-ai/cordis';
import {
  LlmError, assertUsableApiKey, resolveImageAttachmentAccess,
  type AdapterRegistrationHandle, type DirectoryRegistrationHandle,
} from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-settings';
import type {} from '@deepseek-ai/dsh-credentials';
import type {} from '@deepseek-ai/dsh-attachment';
import type {} from '@deepseek-ai/dsh-fs';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { GatewayAdapter } from './adapter.js';
import { Config, resolveProfiles, type ResolvedProfile } from './config.js';
import { discoverModels } from './discovery.js';
import { NS } from './shared.js';

export { Config, resolveProfiles, GatewayAdapter, discoverModels };
export type { GatewayModel, GatewayProfile, Effort } from './shared.js';
export const name = NS;
export const inject = ['llm'];

export function apply(ctx: Context, config: Config): void {
  let source = () => config;
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
    if (raw === nextRaw && registration) return;
    const next = resolveProfiles(nextRaw);
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
    if (!synchronizing && raw !== source() && rejected !== source()) {
      try { synchronize(); } catch { rejected = source(); ctx.logger.warn('第三方 DeepSeek 配置未生效，保留最后有效网关配置'); }
    }
    return profiles;
  };
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
  synchronize();
  ctx.llm.registerModelDiscovery(NS, (request, signal) => discoverModels(request, current(), key, signal));
  ctx.inject(['settings'], settingsCtx => {
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
      setSource: next => { source = next; },
      validate: value => {
        const proposed = resolveProfiles(value);
        const owned = new Set(profiles.keys());
        const taken = ctx.llm.listProviders().filter(p => !owned.has(p.id));
        const declared = ctx.llm.listConfigurableProviders().filter(p => p.settingsNs !== NS);
        if ([...proposed.keys()].some(id => taken.some(p => p.id === id) || declared.some(p => p.provider === id))) throw new LlmError('提供方 ID 已被其他适配器占用', 'DUPLICATE_ADAPTER');
      },
      onChange: synchronize,
    });
  });
}
