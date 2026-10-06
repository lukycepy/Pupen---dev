import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildDefaultPagesConfig } from '@/lib/site/pages-registry';

export const dynamic = 'force-dynamic';

const SITE_CONFIG_ID = Number(process.env.SITE_CONFIG_ID || 1);

const defaultPages: Record<string, any> = buildDefaultPagesConfig();

const defaultHome: Record<string, any> = {
  widgets: {
    hero: true,
    countdown: true,
    about: true,
    news: true,
    poll: true,
    testimonials: true,
    instagram: true,
    partners: true,
    newsletter: true,
    cta: true,
  },
  hero: {
    backgrounds: [],
    backgroundsA: [],
    backgroundsB: [],
    ab: { enabled: false, split: 50 },
  },
  instagram: {
    url: 'https://instagram.com/pupenfappz/',
    handle: '@pupenfappz',
  },
  cta: {},
  testimonials: {},
};

const defaultMemberPortal: Record<string, any> = {
  show_onboarding: true,
  hidden_tabs: [],
  default_tab: null,
  support_email: 'support@pupen.org',
  support_phone: null,
  quick_links: [],
  directory: {
    show_map: true,
    fields: ['email', 'member_since', 'city'],
  },
};

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const configId = Number.isFinite(SITE_CONFIG_ID) && SITE_CONFIG_ID >= 1 ? SITE_CONFIG_ID : 1;
    const res = await supabase
      .from('site_public_config')
      .select(
        'maintenance_enabled, maintenance_start_at, maintenance_end_at, maintenance_title_cs, maintenance_body_cs, maintenance_title_en, maintenance_body_en, pages, home, member_portal, updated_at',
      )
      .eq('id', configId)
      .maybeSingle();

    if (res.error) throw res.error;
    const row: any = res.data || {};

    const now = Date.now();
    const startAt = row.maintenance_start_at ? String(row.maintenance_start_at) : null;
    const endAt = row.maintenance_end_at ? String(row.maintenance_end_at) : null;
    const startMs = startAt ? Date.parse(startAt) : null;
    const endMs = endAt ? Date.parse(endAt) : null;
    const windowAllows = (!startMs || now >= startMs) && (!endMs || now < endMs);
    const ended = !!endMs && now >= endMs;

    if (!!row.maintenance_enabled && ended) {
      try {
        const { error: updateError } = await supabase
          .from('site_public_config')
          .update({
            maintenance_enabled: false,
            maintenance_start_at: null,
            maintenance_end_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', configId);
        if (updateError) {
          console.error('Auto-disable maintenance failed:', updateError);
        } else {
          row.maintenance_enabled = false;
        }
      } catch (e) {
        console.error('Auto-disable maintenance error:', e);
      }
    }

    const homeRow = row.home && typeof row.home === 'object' ? row.home : {};
    const mergedHome = {
      ...defaultHome,
      ...homeRow,
      widgets: { ...defaultHome.widgets, ...(homeRow.widgets && typeof homeRow.widgets === 'object' ? homeRow.widgets : {}) },
      hero: { ...defaultHome.hero, ...(homeRow.hero && typeof homeRow.hero === 'object' ? homeRow.hero : {}) },
      instagram: { ...defaultHome.instagram, ...(homeRow.instagram && typeof homeRow.instagram === 'object' ? homeRow.instagram : {}) },
    };

    const memberPortalRow = row.member_portal && typeof row.member_portal === 'object' ? row.member_portal : {};
    const mergedMemberPortal = {
      ...defaultMemberPortal,
      ...memberPortalRow,
      hidden_tabs: Array.isArray(memberPortalRow.hidden_tabs) ? memberPortalRow.hidden_tabs : defaultMemberPortal.hidden_tabs,
      quick_links: Array.isArray(memberPortalRow.quick_links) ? memberPortalRow.quick_links : defaultMemberPortal.quick_links,
      directory: {
        ...defaultMemberPortal.directory,
        ...(memberPortalRow.directory && typeof memberPortalRow.directory === 'object' ? memberPortalRow.directory : {}),
        fields: Array.isArray(memberPortalRow?.directory?.fields) ? memberPortalRow.directory.fields : defaultMemberPortal.directory.fields,
        show_map: typeof memberPortalRow?.directory?.show_map === 'boolean' ? memberPortalRow.directory.show_map : defaultMemberPortal.directory.show_map,
      },
    };

    const out = NextResponse.json({
      ok: true,
      config: {
        maintenance_enabled: !!row.maintenance_enabled && !ended,
        maintenance_start_at: startAt,
        maintenance_end_at: endAt,
        maintenance_active: !!row.maintenance_enabled && !ended && windowAllows,
        maintenance_title_cs: row.maintenance_title_cs || null,
        maintenance_body_cs: row.maintenance_body_cs || null,
        maintenance_title_en: row.maintenance_title_en || null,
        maintenance_body_en: row.maintenance_body_en || null,
        pages: { ...defaultPages, ...(row.pages || {}) },
        home: mergedHome,
        member_portal: mergedMemberPortal,
        updated_at: row.updated_at || null,
      },
    });
    out.headers.set('Cache-Control', 'no-store');
    return out;
  } catch {
    const out = NextResponse.json({
      ok: true,
      config: {
        maintenance_enabled: false,
        maintenance_start_at: null,
        maintenance_end_at: null,
        maintenance_active: false,
        maintenance_title_cs: null,
        maintenance_body_cs: null,
        maintenance_title_en: null,
        maintenance_body_en: null,
        pages: defaultPages,
        home: defaultHome,
        member_portal: defaultMemberPortal,
        updated_at: null,
      },
    });
    out.headers.set('Cache-Control', 'no-store');
    return out;
  }
}
