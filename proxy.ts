import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['cs', 'en'];
const defaultLocale = 'cs';
const COOKIE_NAME = 'NEXT_LOCALE';

type SiteConfig = {
  maintenance_enabled: boolean;
  pages: Record<string, { enabled?: boolean; navbar?: boolean; tools?: boolean }>;
};

const siteCache: { value: SiteConfig | null; atMs: number } =
  (globalThis as any).__PUPEN_SITE_CONFIG_CACHE__ || { value: null, atMs: 0 };
(globalThis as any).__PUPEN_SITE_CONFIG_CACHE__ = siteCache;

async function loadConfig(): Promise<SiteConfig> {
  const now = Date.now();
  if (siteCache.value && now - siteCache.atMs < 30_000) return siteCache.value;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    const fallback = { maintenance_enabled: false, pages: {} };
    siteCache.value = fallback;
    siteCache.atMs = now;
    return fallback;
  }

  const res = await fetch(`${url}/rest/v1/site_public_config?id=eq.1&select=maintenance_enabled,pages`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const fallback = { maintenance_enabled: false, pages: {} };
    siteCache.value = fallback;
    siteCache.atMs = now;
    return fallback;
  }

  const data = (await res.json().catch(() => [])) as any[];
  const row = Array.isArray(data) ? data[0] : null;
  const value: SiteConfig = {
    maintenance_enabled: !!row?.maintenance_enabled,
    pages: (row?.pages && typeof row.pages === 'object' ? row.pages : {}) as any,
  };
  siteCache.value = value;
  siteCache.atMs = now;
  return value;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameIsMissingLocale = locales.every((locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`);

  if (pathnameIsMissingLocale) {
    if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname.includes('.')) {
      return;
    }

    const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;
    const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;

    return NextResponse.redirect(new URL(`/${locale}${pathname === '/' ? '' : pathname}`, request.url));
  }

  const currentLocale = pathname.split('/')[1];
  if (locales.includes(currentLocale)) {
    return (async () => {
      const cfg = await loadConfig();

      const normalized = pathname.replace(/^\//, '');
      const allowDuringMaintenance = new Set([
        `${currentLocale}/odstavka`,
        `${currentLocale}/login`,
        `${currentLocale}/admin`,
        `${currentLocale}/admin/dashboard`,
        `${currentLocale}/clen`,
      ]);
      const isAllowed = Array.from(allowDuringMaintenance).some((p) => normalized === p || normalized.startsWith(`${p}/`));

      if (cfg.maintenance_enabled && !isAllowed) {
        return NextResponse.redirect(new URL(`/${currentLocale}/odstavka`, request.url));
      }

      const parts = pathname.split('/').filter(Boolean);
      const slug = parts.length >= 2 ? parts[1] : null;
      if (slug && cfg.pages?.[slug]?.enabled === false) {
        return NextResponse.redirect(new URL(`/${currentLocale}`, request.url));
      }

      const response = NextResponse.next();
      const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;

      if (cookieLocale !== currentLocale) {
        response.cookies.set(COOKIE_NAME, currentLocale, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
        });
      }
      return response;
    })();
  }
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|logo.png|img|public).*)'],
};
