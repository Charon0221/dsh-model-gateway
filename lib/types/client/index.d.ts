import type { Context } from '@deepseek-ai/cordis';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client';
import { type GatewayProfile } from '../shared.js';
import type { ClientOperations } from './controller.js';
interface Section {
    providers?: Record<string, GatewayProfile>;
}
interface Injected {
    scope: ConfigForm<Section>;
    operations: ClientOperations;
    taken: () => readonly string[];
    ctx: Context;
}
export declare function GatewayFooter({ scope, operations, taken, ctx }: Injected): import("react/jsx-runtime").JSX.Element | null;
export declare function GatewayCard({ provider, scope, operations, taken }: Injected & ProviderCardExtrasOwnerProps): import("react/jsx-runtime").JSX.Element | null;
export declare const inject: string[];
export declare function apply(ctx: Context): void;
export {};
