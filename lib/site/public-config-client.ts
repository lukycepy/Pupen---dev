type CachedSiteConfigPayload = {
  ok?: boolean;
  config?: Record<string, unknown>;
};

const SITE_CONFIG_CACHE_KEY = 'pupen_site_config_cache_v1';
const SITE_CONFIG_TTL_MS = 60_000;

let memoryCache: { value: CachedSiteConfigPayload; expiresAt: number } | null = null;
let inFlight: Promise<CachedSiteConfigPayload> | null = null;

function readSessionCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SITE_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: unknown; value?: CachedSiteConfigPayload };
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!expiresAt || Date.now() >= expiresAt || !parsed?.value) return null;
    return { value: parsed.value, expiresAt };
  } catch {
    return null;
  }
}

function writeSessionCache(entry: { value: CachedSiteConfigPayload; expiresAt: number }) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SITE_CONFIG_CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

export async function getCachedPublicSiteConfig() {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) return memoryCache.value;

  const sessionCache = readSessionCache();
  if (sessionCache) {
    memoryCache = sessionCache;
    return sessionCache.value;
  }

  if (inFlight) return inFlight;

  inFlight = fetch('/api/site-config')
    .then(async (res) => {
      const json = (await res.json().catch(() => ({}))) as CachedSiteConfigPayload;
      if (!res.ok) throw new Error(String((json as { error?: unknown })?.error || 'Request failed'));
      const entry = { value: json, expiresAt: Date.now() + SITE_CONFIG_TTL_MS };
      memoryCache = entry;
      writeSessionCache(entry);
      return json;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function invalidateCachedPublicSiteConfig() {
  memoryCache = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SITE_CONFIG_CACHE_KEY);
  } catch {}
}
