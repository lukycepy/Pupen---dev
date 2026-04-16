type RateLimitResult =
  | { ok: true; remaining: number; resetAtMs: number }
  | { ok: false; retryAfterMs: number; resetAtMs: number };

type Options = {
  bucket: string;
  key: string;
  windowMs: number;
  max: number;
};

const store: Map<string, { count: number; resetAtMs: number }> =
  (globalThis as any).__PUPEN_RATE_LIMIT_STORE__ || new Map();
(globalThis as any).__PUPEN_RATE_LIMIT_STORE__ = store;

async function rateLimitSharedDb({ bucket, key, windowMs, max }: Options): Promise<RateLimitResult | null> {
  const windowSeconds = Math.max(1, Math.floor(Number(windowMs) / 1000));
  if (!Number.isFinite(windowSeconds) || windowSeconds < 1) return null;

  try {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const supabase = getServerSupabase();
    const res = await supabase.rpc('rate_limit_check', {
      bucket_name: String(bucket || '').slice(0, 120),
      key_value: String(key || '').slice(0, 160),
      window_seconds: windowSeconds,
      max_count: Math.max(1, Math.floor(Number(max) || 1)),
    });
    if (res.error) return null;

    const row: any = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!row) return null;

    const resetAtMs = row.reset_at ? Date.parse(String(row.reset_at)) : NaN;
    if (!Number.isFinite(resetAtMs)) return null;

    const allowed = !!row.allowed;
    const remaining = Math.max(0, Math.floor(Number(row.remaining) || 0));
    const now = Date.now();

    if (!allowed) {
      return { ok: false, retryAfterMs: Math.max(0, resetAtMs - now), resetAtMs };
    }
    return { ok: true, remaining, resetAtMs };
  } catch {
    return null;
  }
}

export function getClientIp(req: Request) {
  const h = req.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || null;
  const xri = h.get('x-real-ip');
  if (xri) return xri.trim() || null;
  return null;
}

export async function rateLimit({ bucket, key, windowMs, max }: Options): Promise<RateLimitResult> {
  const shared = await rateLimitSharedDb({ bucket, key, windowMs, max });
  if (shared) return shared;

  const memKey = `${bucket}:${key}`;
  const now = Date.now();
  const existing = store.get(memKey);
  if (!existing || existing.resetAtMs <= now) {
    const resetAtMs = now + windowMs;
    store.set(memKey, { count: 1, resetAtMs });
    return { ok: true, remaining: Math.max(0, max - 1), resetAtMs };
  }

  if (existing.count >= max) {
    return { ok: false, retryAfterMs: Math.max(0, existing.resetAtMs - now), resetAtMs: existing.resetAtMs };
  }

  existing.count += 1;
  store.set(memKey, existing);
  return { ok: true, remaining: Math.max(0, max - existing.count), resetAtMs: existing.resetAtMs };
}
