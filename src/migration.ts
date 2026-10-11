import { copyFile, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SettingsDescriptor, SettingsPathOp } from '@deepseek-ai/dsh-settings';
import { restoreOfficialDefaults } from './catalog.js';
import { NS, type GatewayProfile } from './shared.js';

const MIGRATION = 'official-capabilities-v1';
const running = new Map<string, Promise<'complete' | 'readonly'>>();
function jsonValue<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function stable(value: unknown): string {
  return JSON.stringify(value, (key, item) => {
    // Schemastery materializes an omitted dictionary as {} on restart.
    if (key === 'nativeSearchConfig' && item && Object.keys(item).length === 0) return undefined;
    return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item;
  });
}
export function capabilityMigrationOps(providers: Record<string, GatewayProfile> = {}): SettingsPathOp[] {
  return Object.entries(providers).map(([route, profile]) => ({ op: 'set', path: ['providers', route, 'models'], value: jsonValue(profile.models.map(m => restoreOfficialDefaults(m, profile.protocol ?? 'chat-completions'))) }));
}
interface MigrationSettings {
  documentPath: string; writable: boolean;
  describe(): SettingsDescriptor[];
  mutate(ns: string, ops: readonly SettingsPathOp[], revision?: number): Promise<void>;
}
/** Profile-local marker: never adds fields to the plugin's public configuration. */
export async function migrateCapabilities(settings: MigrationSettings): Promise<'complete' | 'readonly'> {
  const existing = running.get(settings.documentPath);
  if (existing) return existing;
  const operation = migrate(settings);
  running.set(settings.documentPath, operation);
  try { return await operation; }
  catch (error) {
    const marker = join(dirname(settings.documentPath), '.plugin-manager', 'migrations', `${MIGRATION}.json`);
    try {
      const journal = JSON.parse(await readFile(marker, 'utf8'));
      journal.lastFailure = { name: error instanceof Error ? error.name : 'unknown' };
      await writeFile(marker, JSON.stringify(journal), { mode: 0o600 });
    } catch { /* Preserve the original settings error when diagnostics cannot be saved. */ }
    throw error;
  } finally { running.delete(settings.documentPath); }
}
async function migrate(settings: MigrationSettings): Promise<'complete' | 'readonly'> {
  const dir = join(dirname(settings.documentPath), '.plugin-manager', 'migrations');
  const marker = join(dir, `${MIGRATION}.json`);
  let journal: { complete?: boolean; backup?: string; before?: string; target?: string } | undefined;
  try { journal = JSON.parse(await readFile(marker, 'utf8')); if (journal?.complete === true) return 'complete'; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  if (!settings.writable) return 'readonly';
  const descriptor = settings.describe().find(d => d.ns === NS);
  if (!descriptor) throw new Error('模型网关配置尚未就绪');
  await mkdir(dir, { recursive: true });
  // The backup precedes any settings write and also protects redacted headers.
  const providers = (descriptor.value as { providers?: Record<string, GatewayProfile> }).providers ?? {};
  const before = stable(Object.entries(providers).map(([id, p]) => [id, p.models]));
  const ops = capabilityMigrationOps(providers);
  const target = stable(ops.map(op => [op.path[1], op.op === 'set' ? op.value : undefined]));
  if (journal?.before) journal.before = stable(JSON.parse(journal.before));
  if (journal?.target) journal.target = stable(JSON.parse(journal.target));
  // A crash after Settings.mutate must not reset later manual changes. An
  // interrupted journal is completed only when the exact target is observed;
  // a different document is left alone for explicit restore in the editor.
  if (journal && before !== journal.before && before !== journal.target) throw new Error('迁移中断后配置已变化，请在编辑器恢复官方默认');
  const backup = journal?.backup ?? join(dir, `${MIGRATION}-${Date.now()}.backup.yml`);
  if (!journal) {
    await copyFile(settings.documentPath, backup);
    await writeFile(marker, JSON.stringify({ complete: false, backup, before, target }), { mode: 0o600 });
  }
  if (ops.length && before !== journal?.target) await settings.mutate(NS, ops, descriptor.revision);
  const pending = `${marker}.tmp`;
  await writeFile(pending, JSON.stringify({ complete: true, migration: MIGRATION, completedAt: new Date().toISOString(), backup }, null, 2), { mode: 0o600 });
  await rename(pending, marker);
  return 'complete';
}
