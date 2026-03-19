type RateLimitResult =
  | { ok: true; remaining: number; resetAtMs: number }
  | { ok: false; retryAfterMs: number; resetAtMs: number };

type Options = {
  key: string;
  windowMs: number;
  max: number;
};

const store: Map<string, { count: number; resetAtMs: number }> =
  (globalThis as any).__PUPEN_RATE_LIMIT_STORE__ || new Map();
(globalThis as any).__PUPEN_RATE_LIMIT_STORE__ = store;

export function getClientIp(req: Request) {
  const h = req.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || null;
  const xri = h.get('x-real-ip');
  if (xri) return xri.trim() || null;
  return null;
}

export function rateLimit({ key, windowMs, max }: Options): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAtMs <= now) {
    const resetAtMs = now + windowMs;
    store.set(key, { count: 1, resetAtMs });
    return { ok: true, remaining: Math.max(0, max - 1), resetAtMs };
  }

  if (existing.count >= max) {
    return { ok: false, retryAfterMs: Math.max(0, existing.resetAtMs - now), resetAtMs: existing.resetAtMs };
  }

  existing.count += 1;
  store.set(key, existing);
  return { ok: true, remaining: Math.max(0, max - existing.count), resetAtMs: existing.resetAtMs };
}

