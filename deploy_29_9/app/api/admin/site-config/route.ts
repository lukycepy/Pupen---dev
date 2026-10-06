import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin, requireUser } from '@/lib/server-auth';

const SITE_CONFIG_ID = Number(process.env.SITE_CONFIG_ID || 1);

interface ProfilePermissionsRow {
  can_manage_admins?: boolean | null;
  can_edit_site_nav?: boolean | null;
  can_edit_site_home?: boolean | null;
  can_edit_site_member_portal?: boolean | null;
  can_edit_site_maintenance?: boolean | null;
}

interface SitePublicConfigRow {
  maintenance_enabled?: boolean | null;
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  maintenance_title_cs?: string | null;
  maintenance_body_cs?: string | null;
  maintenance_title_en?: string | null;
  maintenance_body_en?: string | null;
  pages?: Record<string, unknown> | null;
  home?: Record<string, unknown> | null;
  member_portal?: Record<string, unknown> | null;
  updated_at?: string | null;
}

interface SiteConfigRequestBody {
  section?: unknown;
  config?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function asOptionalTrimmedString(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
}

function asIsoDateOrNull(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { value: null, error: null as string | null };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, error: 'invalid' as const };
  }
  return { value: parsed.toISOString(), error: null as string | null };
}

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
      .maybeSingle<SitePublicConfigRow>();
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, config: res.data || null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = body as SiteConfigRequestBody;
    const section = String(payload.section || '').trim();
    const patch = toRecord(payload.config);

    const supabase = getServerSupabase();
    const configId = Number.isFinite(SITE_CONFIG_ID) && SITE_CONFIG_ID >= 1 ? SITE_CONFIG_ID : 1;

    const profRes = await supabase
      .from('profiles')
      .select('can_manage_admins, can_edit_site_nav, can_edit_site_home, can_edit_site_member_portal, can_edit_site_maintenance')
      .eq('id', user.id)
      .maybeSingle<ProfilePermissionsRow>();
    if (profRes.error) throw profRes.error;
    const profile = profRes.data;

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
      .maybeSingle<SitePublicConfigRow>();
    if (current.error) throw current.error;
    const base: SitePublicConfigRow = current.data || {};

    const out: SitePublicConfigRow = {
      maintenance_enabled: base.maintenance_enabled ?? false,
      maintenance_start_at: base.maintenance_start_at ?? null,
      maintenance_end_at: base.maintenance_end_at ?? null,
      maintenance_title_cs: base.maintenance_title_cs ?? null,
      maintenance_body_cs: base.maintenance_body_cs ?? null,
      maintenance_title_en: base.maintenance_title_en ?? null,
      maintenance_body_en: base.maintenance_body_en ?? null,
      pages: toRecord(base?.pages),
      home: toRecord(base?.home),
      member_portal: toRecord(base?.member_portal),
    };

    if (section === 'maintenance') {
      const maintenanceEnabled = !!patch.maintenance_enabled;
      const startAt = asIsoDateOrNull(patch.maintenance_start_at);
      const endAt = asIsoDateOrNull(patch.maintenance_end_at);
      if (startAt.error) return NextResponse.json({ error: 'Invalid maintenance_start_at' }, { status: 400 });
      if (endAt.error) return NextResponse.json({ error: 'Invalid maintenance_end_at' }, { status: 400 });
      if (startAt.value && endAt.value && new Date(startAt.value).getTime() > new Date(endAt.value).getTime()) {
        return NextResponse.json({ error: 'maintenance_start_at must be <= maintenance_end_at' }, { status: 400 });
      }
      out.maintenance_enabled = maintenanceEnabled;
      out.maintenance_start_at = startAt.value;
      out.maintenance_end_at = endAt.value;
      out.maintenance_title_cs = asOptionalTrimmedString(patch.maintenance_title_cs, 200);
      out.maintenance_body_cs = asOptionalTrimmedString(patch.maintenance_body_cs, 4000);
      out.maintenance_title_en = asOptionalTrimmedString(patch.maintenance_title_en, 200);
      out.maintenance_body_en = asOptionalTrimmedString(patch.maintenance_body_en, 4000);
    } else if (section === 'home') {
      out.home = toRecord(patch.home);
    } else if (section === 'member') {
      out.member_portal = toRecord(patch.member_portal);
    } else if (section === 'pages') {
      out.pages = toRecord(patch.pages);
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
      .single<SitePublicConfigRow>();
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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
