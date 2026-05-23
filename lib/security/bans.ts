import { getServerSupabase } from '@/lib/supabase-server';

type CacheEntry = { banned: boolean; atMs: number };

const cache: Map<string, CacheEntry> = (globalThis as any).__PUPEN_BAN_CACHE__ || new Map();
(globalThis as any).__PUPEN_BAN_CACHE__ = cache;

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

    const raw: any = res.data;
    const banned = Array.isArray(raw) ? !!raw[0] : !!raw;
    cache.set(key, { banned, atMs: now });
    return banned;
  } catch {
    return false;
  }
}
