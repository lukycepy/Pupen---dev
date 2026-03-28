import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['cs', 'en'];
const defaultLocale = 'cs';
const COOKIE_NAME = 'NEXT_LOCALE';
const SITE_CONFIG_ID = Number(process.env.SITE_CONFIG_ID || 1);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const CONFIG_CACHE_TTL_MS = 10_000;
let cachedConfig: { at: number; cfg: SiteConfig } | null = null;

type SiteConfig = {
  maintenance_enabled: boolean;
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  maintenance_active?: boolean;
  pages: Record<string, { enabled?: boolean; navbar?: boolean; tools?: boolean }>;
};

async function loadConfig(): Promise<SiteConfig> {
  if (cachedConfig && Date.now() - cachedConfig.at < CONFIG_CACHE_TTL_MS) return cachedConfig.cfg;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { maintenance_enabled: false, maintenance_start_at: null, maintenance_end_at: null, maintenance_active: false, pages: {} };
  }
  try {
    const configId = Number.isFinite(SITE_CONFIG_ID) && SITE_CONFIG_ID >= 1 ? SITE_CONFIG_ID : 1;
    const base = SUPABASE_URL.replace(/\/$/, '');
    const url = `${base}/rest/v1/site_public_config?id=eq.${encodeURIComponent(String(configId))}&select=maintenance_enabled,maintenance_start_at,maintenance_end_at,pages,updated_at`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    } as any);
    const rows = (await res.json().catch(() => [])) as any[];
    const row = (Array.isArray(rows) && rows[0] ? rows[0] : {}) as any;

    const now = Date.now();
    const startAt = row.maintenance_start_at ? String(row.maintenance_start_at) : null;
    const endAt = row.maintenance_end_at ? String(row.maintenance_end_at) : null;
    const startMs = startAt ? Date.parse(startAt) : null;
    const endMs = endAt ? Date.parse(endAt) : null;
    const windowAllows = (!startMs || now >= startMs) && (!endMs || now < endMs);
    const ended = !!endMs && now >= endMs;

    const value: SiteConfig = {
      maintenance_enabled: !!row.maintenance_enabled && !ended,
      maintenance_start_at: startAt,
      maintenance_end_at: endAt,
      maintenance_active: !!row.maintenance_enabled && !ended && windowAllows,
      pages: (row.pages && typeof row.pages === 'object' ? row.pages : {}) as any,
    };
    cachedConfig = { at: Date.now(), cfg: value };
    return value;
  } catch {
    return cachedConfig?.cfg || { maintenance_enabled: false, maintenance_start_at: null, maintenance_end_at: null, maintenance_active: false, pages: {} };
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

    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    const res = NextResponse.redirect(url, 307);
    res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    res.headers.set('x-middleware-cache', 'no-cache');
    if (cookieLocale !== locale) {
      res.cookies.set(COOKIE_NAME, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  }

  const currentLocale = pathname.split('/')[1];
  if (locales.includes(currentLocale)) {
    return (async () => {
      const cfg = await loadConfig();

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
        const res = NextResponse.redirect(url, 307);
        res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
        res.headers.set('x-middleware-cache', 'no-cache');
        return res;
      }

      if (normalized === `${currentLocale}/odstavka` && !cfg.maintenance_active) {
        const res = NextResponse.redirect(new URL(`/${currentLocale}`, request.url));
        res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
        res.headers.set('x-middleware-cache', 'no-cache');
        return res;
      }

      const parts = pathname.split('/').filter(Boolean);
      const slug = parts.length >= 2 ? parts[1] : null;
      if (slug && cfg.pages?.[slug]?.enabled === false) {
        const res = NextResponse.redirect(new URL(`/${currentLocale}`, request.url));
        res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
        res.headers.set('x-middleware-cache', 'no-cache');
        return res;
      }

      const response = NextResponse.next();
      response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
      response.headers.set('x-middleware-cache', 'no-cache');
      response.headers.set('x-pupen-maintenance', cfg.maintenance_active ? '1' : '0');

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
