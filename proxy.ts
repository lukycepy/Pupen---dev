import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['cs', 'en'];
const defaultLocale = 'cs';
const COOKIE_NAME = 'NEXT_LOCALE';
const SITE_CONFIG_ID = Number(process.env.SITE_CONFIG_ID || 1);

type SiteConfig = {
  maintenance_enabled: boolean;
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  maintenance_active?: boolean;
  pages: Record<string, { enabled?: boolean; navbar?: boolean; tools?: boolean }>;
};

const siteCache: { value: SiteConfig | null; atMs: number } =
  (globalThis as any).__PUPEN_SITE_CONFIG_CACHE__ || { value: null, atMs: 0 };
(globalThis as any).__PUPEN_SITE_CONFIG_CACHE__ = siteCache;

async function loadConfig(origin: string): Promise<SiteConfig> {
  const now = Date.now();
  if (siteCache.value && now - siteCache.atMs < 30_000) return siteCache.value;

  try {
    const res = await fetch(new URL('/api/site-config', origin || 'http://localhost').toString(), {
      cache: 'no-store',
    } as any);
    const json = (await res.json().catch(() => ({}))) as any;
    const cfg = (json?.config && typeof json.config === 'object' ? json.config : {}) as any;
    const value: SiteConfig = {
      maintenance_enabled: !!cfg.maintenance_enabled,
      maintenance_start_at: cfg.maintenance_start_at ?? null,
      maintenance_end_at: cfg.maintenance_end_at ?? null,
      maintenance_active: !!cfg.maintenance_active,
      pages: (cfg.pages && typeof cfg.pages === 'object' ? cfg.pages : {}) as any,
    };
    siteCache.value = value;
    siteCache.atMs = now;
    return value;
  } catch {
    const fallback = { maintenance_enabled: false, pages: {} };
    siteCache.value = fallback;
    siteCache.atMs = now;
    return fallback;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameIsMissingLocale = locales.every((locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`);

  if (pathnameIsMissingLocale) {
    if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname.includes('.')) {
      return;
    }

    const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;
    const accept = request.headers.get('accept-language') || '';
    const prefersEn = /\ben\b/i.test(accept) && !/\bcs\b/i.test(accept);
    const prefersCs = /\bcs\b/i.test(accept) || /\bsk\b/i.test(accept);
    const inferredLocale = prefersCs ? 'cs' : prefersEn ? 'en' : defaultLocale;
    const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : inferredLocale;

    return NextResponse.redirect(new URL(`/${locale}${pathname === '/' ? '' : pathname}`, request.url));
  }

  const currentLocale = pathname.split('/')[1];
  if (locales.includes(currentLocale)) {
    return (async () => {
      const cfg = await loadConfig(request.nextUrl.origin);

      const normalized = pathname.replace(/^\//, '');
      const allowDuringMaintenance = new Set([
        `${currentLocale}/odstavka`,
        `${currentLocale}/login`,
        `${currentLocale}/forgot`,
        `${currentLocale}/reset-password`,
        `${currentLocale}/admin`,
        `${currentLocale}/admin/dashboard`,
        `${currentLocale}/clen`,
      ]);
      const isAllowed = Array.from(allowDuringMaintenance).some((p) => normalized === p || normalized.startsWith(`${p}/`));

      if (cfg.maintenance_active && !isAllowed) {
        const url = request.nextUrl.clone();
        url.pathname = `/${currentLocale}/odstavka`;
        const res = NextResponse.rewrite(url);
        res.headers.set('Cache-Control', 'no-store');
        return res;
      }

      if (normalized === `${currentLocale}/odstavka` && !cfg.maintenance_active) {
        return NextResponse.redirect(new URL(`/${currentLocale}`, request.url));
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
