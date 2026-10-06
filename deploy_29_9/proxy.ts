import { NextResponse, type NextRequest } from 'next/server';

type CacheEntry = { banned: boolean; atMs: number };

const cache: Map<string, CacheEntry> = (globalThis as any).__PUPEN_EDGE_BAN_CACHE__ || new Map();
(globalThis as any).__PUPEN_EDGE_BAN_CACHE__ = cache;

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
    const url = req.nextUrl.clone();
    url.pathname = `/cs${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ['/Autodiscover/Autodiscover.xml', '/((?!_next/|.*\\..*).*)'],
};
