import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin, requireUser } from '@/lib/server-auth';

const SITE_CONFIG_ID = Number(process.env.SITE_CONFIG_ID || 1);

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
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

    return NextResponse.json({ ok: true, config: res.data || null });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const section = String(body?.section || '').trim();
    const patch = body?.config || {};

    const supabase = getServerSupabase();
    const configId = Number.isFinite(SITE_CONFIG_ID) && SITE_CONFIG_ID >= 1 ? SITE_CONFIG_ID : 1;

    const profRes = await supabase
      .from('profiles')
      .select('can_manage_admins, can_edit_site_nav, can_edit_site_home, can_edit_site_member_portal, can_edit_site_maintenance')
      .eq('id', user.id)
      .maybeSingle();
    if (profRes.error) throw profRes.error;
    const profile: any = profRes.data || {};

    const canAll = !!profile?.can_manage_admins;
    const allowMaintenance = canAll || !!profile?.can_edit_site_maintenance;
    const allowHome = canAll || !!profile?.can_edit_site_home;
    const allowMember = canAll || !!profile?.can_edit_site_member_portal;
    const allowPages = canAll || !!profile?.can_edit_site_nav;

    if (!section) return NextResponse.json({ error: 'Missing section' }, { status: 400 });
    if (
      (section === 'maintenance' && !allowMaintenance) ||
      (section === 'home' && !allowHome) ||
      (section === 'member' && !allowMember) ||
      (section === 'pages' && !allowPages)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const current = await supabase
      .from('site_public_config')
      .select(
        'maintenance_enabled, maintenance_start_at, maintenance_end_at, maintenance_title_cs, maintenance_body_cs, maintenance_title_en, maintenance_body_en, pages, home, member_portal',
      )
      .eq('id', configId)
      .maybeSingle();
    if (current.error) throw current.error;
    const base: any = current.data || {};

    const out: any = {
      maintenance_enabled: base.maintenance_enabled ?? false,
      maintenance_start_at: base.maintenance_start_at ?? null,
      maintenance_end_at: base.maintenance_end_at ?? null,
      maintenance_title_cs: base.maintenance_title_cs ?? null,
      maintenance_body_cs: base.maintenance_body_cs ?? null,
      maintenance_title_en: base.maintenance_title_en ?? null,
      maintenance_body_en: base.maintenance_body_en ?? null,
      pages: base.pages && typeof base.pages === 'object' ? base.pages : {},
      home: base.home && typeof base.home === 'object' ? base.home : {},
      member_portal: base.member_portal && typeof base.member_portal === 'object' ? base.member_portal : {},
    };

    if (section === 'maintenance') {
      const maintenance_enabled = !!patch.maintenance_enabled;
      const startAtRaw = patch.maintenance_start_at ? String(patch.maintenance_start_at) : '';
      const endAtRaw = patch.maintenance_end_at ? String(patch.maintenance_end_at) : '';
      const startAt = startAtRaw ? new Date(startAtRaw) : null;
      const endAt = endAtRaw ? new Date(endAtRaw) : null;
      if (startAt && Number.isNaN(startAt.getTime())) return NextResponse.json({ error: 'Invalid maintenance_start_at' }, { status: 400 });
      if (endAt && Number.isNaN(endAt.getTime())) return NextResponse.json({ error: 'Invalid maintenance_end_at' }, { status: 400 });
      if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
        return NextResponse.json({ error: 'maintenance_start_at must be <= maintenance_end_at' }, { status: 400 });
      }
      out.maintenance_enabled = maintenance_enabled;
      out.maintenance_start_at = startAt ? startAt.toISOString() : null;
      out.maintenance_end_at = endAt ? endAt.toISOString() : null;
      out.maintenance_title_cs = patch.maintenance_title_cs ? String(patch.maintenance_title_cs).slice(0, 200) : null;
      out.maintenance_body_cs = patch.maintenance_body_cs ? String(patch.maintenance_body_cs).slice(0, 4000) : null;
      out.maintenance_title_en = patch.maintenance_title_en ? String(patch.maintenance_title_en).slice(0, 200) : null;
      out.maintenance_body_en = patch.maintenance_body_en ? String(patch.maintenance_body_en).slice(0, 4000) : null;
    } else if (section === 'home') {
      out.home = patch.home && typeof patch.home === 'object' ? patch.home : {};
    } else if (section === 'member') {
      out.member_portal = patch.member_portal && typeof patch.member_portal === 'object' ? patch.member_portal : {};
    } else if (section === 'pages') {
      out.pages = patch.pages && typeof patch.pages === 'object' ? patch.pages : {};
    }

    const up = await supabase
      .from('site_public_config')
      .upsert(
        [
          {
            id: configId,
            updated_at: new Date().toISOString(),
            ...out,
          },
        ],
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    if (up.error) throw up.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'SITE_CONFIG_UPDATE',
          target_id: `site_public_config:${configId}`,
          details: { section },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, config: up.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
