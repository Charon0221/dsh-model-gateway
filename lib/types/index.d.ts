import type { Context } from '@deepseek-ai/cordis';
import { GatewayAdapter } from './adapter.js';
import { Config, resolveProfiles } from './config.js';
import { discoverModels } from './discovery.js';
export { Config, resolveProfiles, GatewayAdapter, discoverModels };
export type { GatewayModel, GatewayProfile, Effort } from './shared.js';
export declare const name = "llm-deepseek-gateway";
export declare const inject: string[];
export declare function apply(ctx: Context, config: Config): void;
