import { getServerSupabase } from '@/lib/supabase-server';

type CacheEntry = { banned: boolean; atMs: number };
type BanRpcResult = boolean | number | string | null;

type GlobalWithBanCache = typeof globalThis & {
  __PUPEN_BAN_CACHE__?: Map<string, CacheEntry>;
};

const globalWithBanCache = globalThis as GlobalWithBanCache;
const cache: Map<string, CacheEntry> = globalWithBanCache.__PUPEN_BAN_CACHE__ || new Map();
globalWithBanCache.__PUPEN_BAN_CACHE__ = cache;

export async function isRequestBanned(opts: { ip?: string | null; identityId?: string | null }) {
  const ip = opts.ip ? String(opts.ip).trim() : '';
  const identityId = opts.identityId ? String(opts.identityId).trim() : '';
  const key = `${ip || 'noip'}:${identityId || 'noid'}`;
  const now = Date.now();
  const prev = cache.get(key);
  if (prev && now - prev.atMs < 30_000) return prev.banned;

  try {
    const supabase = getServerSupabase();
    const res = await supabase.rpc('security_is_banned', {
      ip_text: ip || null,
      identity_id: identityId || null,
    });
    if (res.error) return false;

    const raw = res.data as BanRpcResult | BanRpcResult[];
    const banned = Array.isArray(raw) ? !!raw[0] : !!raw;
    cache.set(key, { banned, atMs: now });
    return banned;
  } catch {
    return false;
  }
}
