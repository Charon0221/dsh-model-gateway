import type { CredentialInfo, LlmModelDiscoveryRequest, SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client';
import type { GatewayModel, GatewayProfile } from '../shared.js';
export interface ClientOperations {
    write(ops: SettingsPathOpView[], revision: number): Promise<SettingsNamespaceView>;
    credential(ref: string): Promise<CredentialInfo | undefined>;
    storeKey(ref: string, key: string): Promise<void>;
    removeKey(ref: string): Promise<void>;
    discover(request: LlmModelDiscoveryRequest): Promise<readonly GatewayModel[]>;
}
/** Serialize a two-stage save. Once settings commit, retry only the key. */
export declare class SaveTransaction {
    committed: boolean;
    revision: number;
    constructor(revision: number);
    save(route: string, profile: GatewayProfile, key: string, operations: ClientOperations, creating: boolean): Promise<void>;
}
export declare function validateDraft(route: string, p: GatewayProfile, key: string, taken: readonly string[], creating: boolean): string | undefined;
