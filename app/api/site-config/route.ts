import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

const defaultPages: Record<string, any> = {
  akce: { enabled: true, navbar: true },
  novinky: { enabled: true, navbar: true },
  'o-nas': { enabled: true, navbar: true },
  kontakt: { enabled: true, navbar: true },
  prihlaska: { enabled: true },
  sos: { enabled: true, tools: true },
  'ztraty-a-nalezy': { enabled: true, tools: true },
  predmety: { enabled: true, tools: true },
  harmonogram: { enabled: true, tools: true },
  pruvodce: { enabled: true, tools: true },
  partaci: { enabled: true, tools: true },
  slevy: { enabled: true, tools: true },
  'oteviraci-doba': { enabled: true, tools: true },
  blog: { enabled: true, tools: true },
  kvizy: { enabled: true, tools: true },
  kariera: { enabled: true, tools: true },
  faq: { enabled: true, tools: true },
};

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const res = await supabase
      .from('site_public_config')
      .select(
        'maintenance_enabled, maintenance_start_at, maintenance_end_at, maintenance_title_cs, maintenance_body_cs, maintenance_title_en, maintenance_body_en, pages, updated_at',
      )
      .eq('id', 1)
      .maybeSingle();

    if (res.error) throw res.error;
    const row: any = res.data || {};

    const now = Date.now();
    const startAt = row.maintenance_start_at ? String(row.maintenance_start_at) : null;
    const endAt = row.maintenance_end_at ? String(row.maintenance_end_at) : null;
    const startMs = startAt ? Date.parse(startAt) : null;
    const endMs = endAt ? Date.parse(endAt) : null;
    const inWindow = !!startMs && now >= startMs && (!endMs || now < endMs);

    return NextResponse.json({
      ok: true,
      config: {
        maintenance_enabled: !!row.maintenance_enabled,
        maintenance_start_at: startAt,
        maintenance_end_at: endAt,
        maintenance_active: !!row.maintenance_enabled || inWindow,
        maintenance_title_cs: row.maintenance_title_cs || null,
        maintenance_body_cs: row.maintenance_body_cs || null,
        maintenance_title_en: row.maintenance_title_en || null,
        maintenance_body_en: row.maintenance_body_en || null,
        pages: { ...defaultPages, ...(row.pages || {}) },
        updated_at: row.updated_at || null,
      },
    });
  } catch {
    return NextResponse.json({
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
        updated_at: null,
      },
    });
  }
}
