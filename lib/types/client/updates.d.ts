export declare const PLUGIN_VERSION = "0.3.2";
export declare const RELEASES_URL = "https://github.com/Charon0221/dsh-model-gateway/releases";
export declare const LATEST_RELEASE_URL = "https://api.github.com/repos/Charon0221/dsh-model-gateway/releases/latest";
export declare const INSTALL_SPEC_PREFIX = "github:Charon0221/dsh-model-gateway#";
export interface PluginUpdateInfo {
    currentVersion: string;
    latestVersion: string;
    releaseUrl: string;
    installSpec: string;
}
export declare function isNewerVersion(current: string, latest: string): boolean;
export declare function resetUpdateCache(): void;
export declare function checkForUpdate(fetchImpl?: typeof fetch, now?: number): Promise<PluginUpdateInfo | null>;
