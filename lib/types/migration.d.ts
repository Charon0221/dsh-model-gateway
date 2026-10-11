import type { SettingsDescriptor, SettingsPathOp } from '@deepseek-ai/dsh-settings';
import { type GatewayProfile } from './shared.js';
export declare function capabilityMigrationOps(providers?: Record<string, GatewayProfile>): SettingsPathOp[];
interface MigrationSettings {
    documentPath: string;
    writable: boolean;
    describe(): SettingsDescriptor[];
    mutate(ns: string, ops: readonly SettingsPathOp[], revision?: number): Promise<void>;
}
/** Profile-local marker: never adds fields to the plugin's public configuration. */
export declare function migrateCapabilities(settings: MigrationSettings): Promise<'complete' | 'readonly'>;
export {};
