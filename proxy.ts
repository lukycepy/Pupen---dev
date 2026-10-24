import { NextResponse, type NextRequest } from 'next/server';

type CacheEntry = { banned: boolean; atMs: number };
type Locale = 'cs' | 'en';
type PublicModeCacheEntry = { mode: 'default' | 'maintenance' | 'onepage'; active: boolean; atMs: number };

const cache: Map<string, CacheEntry> = (globalThis as any).__PUPEN_EDGE_BAN_CACHE__ || new Map();
(globalThis as any).__PUPEN_EDGE_BAN_CACHE__ = cache;
const LOCALE_COOKIE = 'NEXT_LOCALE';

function getClientIp(req: NextRequest) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || null;
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim() || null;
  return (req as any).ip || null;
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1];
  return null;
}

function base64UrlDecode(s: string) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64);
}

function getJwtSub(token: string) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(base64UrlDecode(parts[1]));
    const sub = json?.sub ? String(json.sub) : '';
    return sub || null;
  } catch {
    return null;
  }
}

async function isBanned(ip: string | null, identityId: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return false;

  const k = `${ip || 'noip'}:${identityId || 'noid'}`;
  const now = Date.now();
  const prev = cache.get(k);
  if (prev && now - prev.atMs < 30_000) return prev.banned;

  const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/security_is_banned`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ip_text: ip, identity_id: identityId }),
  }).catch(() => null);

  if (!res || !res.ok) return false;
  const json: any = await res.json().catch(() => null);
  const banned =
    typeof json === 'boolean'
      ? json
      : Array.isArray(json) && typeof json[0] === 'boolean'
        ? json[0]
        : false;
  cache.set(k, { banned, atMs: now });
  return banned;
}

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'cs' || value === 'en';
}

function getPreferredLocale(req: NextRequest): Locale {
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  return 'cs';
}

function setPublicModeCache(entry: PublicModeCacheEntry) {
  (globalThis as any).__PUPEN_PUBLIC_MODE_CACHE__ = entry;
}

async function getPublicMode(req: NextRequest) {
  const now = Date.now();
  const cached = (globalThis as any).__PUPEN_PUBLIC_MODE_CACHE__ as PublicModeCacheEntry | null;
  if (cached && now - cached.atMs < 15_000) return cached;

  const res = await fetch(`${req.nextUrl.origin}/api/site-config`, {
    headers: { 'x-proxy-site-mode': '1' },
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) {
    const fallback = { mode: 'default' as const, active: false, atMs: now };
    setPublicModeCache(fallback);
    return fallback;
  }

  const json = (await res.json().catch(() => ({}))) as {
    config?: { public_mode?: unknown; mode_active?: unknown };
  };
  const mode: PublicModeCacheEntry['mode'] =
    json?.config?.public_mode === 'maintenance' || json?.config?.public_mode === 'onepage'
      ? json.config.public_mode
      : 'default';
  const active = json?.config?.mode_active === true && mode !== 'default';
  const entry = { mode, active, atMs: now };
  setPublicModeCache(entry);
  return entry;
}

function isPublicModeExemptPath(pathname: string, locale: Locale) {
  const prefix = `/${locale}`;
  const suffix = pathname.slice(prefix.length) || '/';
  return (
    suffix === '/odstavka' ||
    suffix.startsWith('/odstavka/') ||
    suffix === '/info' ||
    suffix.startsWith('/info/') ||
    suffix === '/login' ||
    suffix.startsWith('/login/') ||
    suffix === '/forgot' ||
    suffix.startsWith('/forgot/') ||
    suffix === '/reset-password' ||
    suffix.startsWith('/reset-password/') ||
    suffix === '/admin' ||
    suffix.startsWith('/admin/') ||
    suffix === '/clen' ||
    suffix.startsWith('/clen/')
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/Autodiscover/Autodiscover.xml') {
    const url = req.nextUrl.clone();
    url.pathname = '/autodiscover/autodiscover.xml';
    return NextResponse.rewrite(url);
  }

  const ip = getClientIp(req);
  const token = getBearerToken(req);
  const identityId = token ? getJwtSub(token) : null;
  if (ip || identityId) {
    if (await isBanned(ip, identityId)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Banned' }, { status: 403 });
      }
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const isPublicFile = /\.[^/]+$/.test(pathname);
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/apps') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/unsubscribe') ||
    pathname.startsWith('/autodiscover') ||
    pathname.startsWith('/Autodiscover') ||
    pathname.startsWith('/.well-known') ||
    isPublicFile
  ) {
    return NextResponse.next();
  }

  const hasLocale = pathname === '/cs' || pathname.startsWith('/cs/') || pathname === '/en' || pathname.startsWith('/en/');
  if (!hasLocale) {
    const locale = getPreferredLocale(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  const locale = pathname.startsWith('/en') ? 'en' : 'cs';
  const publicMode = await getPublicMode(req);
  if (publicMode.active && !isPublicModeExemptPath(pathname, locale)) {
    const target = publicMode.mode === 'maintenance' ? `/${locale}/odstavka` : `/${locale}/info`;
    if (pathname !== target) {
      const url = req.nextUrl.clone();
      url.pathname = target;
      return NextResponse.redirect(url);
    }
  }
  const response = NextResponse.next();
  if (req.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export default proxy;

export const config = {
  matcher: ['/Autodiscover/Autodiscover.xml', '/((?!_next/|.*\\..*).*)'],
};
