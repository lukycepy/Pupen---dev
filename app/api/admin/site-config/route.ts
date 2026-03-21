import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('site_public_config')
      .select(
        'maintenance_enabled, maintenance_start_at, maintenance_end_at, maintenance_title_cs, maintenance_body_cs, maintenance_title_en, maintenance_body_en, pages, updated_at',
      )
      .eq('id', 1)
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
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const body = await req.json().catch(() => ({}));
    const patch = body?.config || {};

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
    const maintenance_title_cs = patch.maintenance_title_cs ? String(patch.maintenance_title_cs).slice(0, 200) : null;
    const maintenance_body_cs = patch.maintenance_body_cs ? String(patch.maintenance_body_cs).slice(0, 4000) : null;
    const maintenance_title_en = patch.maintenance_title_en ? String(patch.maintenance_title_en).slice(0, 200) : null;
    const maintenance_body_en = patch.maintenance_body_en ? String(patch.maintenance_body_en).slice(0, 4000) : null;
    const pages = patch.pages && typeof patch.pages === 'object' ? patch.pages : {};

    const supabase = getServerSupabase();

    const up = await supabase
      .from('site_public_config')
      .upsert(
        [
          {
            id: 1,
            updated_at: new Date().toISOString(),
            maintenance_enabled,
            maintenance_start_at: startAt ? startAt.toISOString() : null,
            maintenance_end_at: endAt ? endAt.toISOString() : null,
            maintenance_title_cs,
            maintenance_body_cs,
            maintenance_title_en,
            maintenance_body_en,
            pages,
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
          target_id: 'site_public_config:1',
          details: { maintenance_enabled, maintenance_start_at: startAt ? startAt.toISOString() : null, maintenance_end_at: endAt ? endAt.toISOString() : null },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, config: up.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
