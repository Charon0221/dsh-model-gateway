export const PLUGIN_VERSION = '0.5.0';
export const RELEASES_URL = 'https://github.com/Charon0221/dsh-model-gateway/releases';
export const LATEST_RELEASE_URL = 'https://api.github.com/repos/Charon0221/dsh-model-gateway/releases/latest';
export const INSTALL_SPEC_PREFIX = 'github:Charon0221/dsh-model-gateway#';

export interface PluginUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  installSpec: string;
}

interface ReleaseResponse {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
}

interface CacheEntry {
  checkedAt: number;
  result: PluginUpdateInfo | null;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache: CacheEntry | undefined;

function versionParts(value: string): [number, number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

export function isNewerVersion(current: string, latest: string): boolean {
  const a = versionParts(current);
  const b = versionParts(latest);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (b[i] !== a[i]) return b[i] > a[i];
  }
  return false;
}

export function resetUpdateCache(): void {
  cache = undefined;
}

export async function checkForUpdate(
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<PluginUpdateInfo | null> {
  if (cache && now - cache.checkedAt < CACHE_TTL_MS) return cache.result;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
    const release = await response.json() as ReleaseResponse;
    const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
    const latestVersion = tag.replace(/^v/, '');
    const releaseUrl = typeof release.html_url === 'string' ? release.html_url : RELEASES_URL;
    const result = isNewerVersion(PLUGIN_VERSION, latestVersion) && !release.draft && !release.prerelease
      ? { currentVersion: PLUGIN_VERSION, latestVersion, releaseUrl, installSpec: `${INSTALL_SPEC_PREFIX}${tag}` }
      : null;
    cache = { checkedAt: now, result };
    return result;
  } catch {
    // A release check is advisory and must never affect model configuration.
    cache = { checkedAt: now, result: null };
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
