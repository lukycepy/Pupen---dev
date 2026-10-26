import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import { normalizePublicMode } from '@/lib/site/public-mode';
import HomePageClient from './HomePageClient';

interface SitePublicModeRow {
  maintenance_enabled?: boolean | null;
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  home?: Record<string, unknown> | null;
}

export default async function PupenWeb({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en' : 'cs';

  try {
    const supabase = getServerSupabase();
    const configId = Number(process.env.SITE_CONFIG_ID || 1) || 1;
    const { data } = await supabase
      .from('site_public_config')
      .select('maintenance_enabled, maintenance_start_at, maintenance_end_at, home')
      .eq('id', configId)
      .maybeSingle<SitePublicModeRow>();

    const row: SitePublicModeRow = data || {};
    const now = Date.now();
    const startAt = row?.maintenance_start_at ? Date.parse(String(row.maintenance_start_at)) : null;
    const endAt = row?.maintenance_end_at ? Date.parse(String(row.maintenance_end_at)) : null;
    const ended = !!endAt && now >= endAt;
    const windowAllows = (!startAt || now >= startAt) && (!endAt || now < endAt);
    const home = row?.home && typeof row.home === 'object' ? row.home : {};
    const publicMode = normalizePublicMode((home as { public_mode?: unknown }).public_mode, !!row?.maintenance_enabled);
    const isActive = publicMode !== 'default' && !!row?.maintenance_enabled && !ended && windowAllows;

    if (isActive) {
      redirect(publicMode === 'maintenance' ? `/${locale}/odstavka` : `/${locale}/info`);
    }
  } catch {
    // If site-config cannot be read, fall back to the standard homepage.
  }

  return <HomePageClient lang={locale} />;
}
