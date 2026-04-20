import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

const ITEM_STATUS = new Set(['open', 'claimed', 'in_progress', 'returned', 'archived']);
function normalizeStatus(input: any) {
  const s = String(input || '').trim();
  return ITEM_STATUS.has(s) ? s : 'open';
}

export async function PATCH(req: Request, ctx: any) {
  try {
    const { user } = await requireAdmin(req);
    const id = String(ctx?.params?.id || '');
    if (!id) throw new Error('BadRequest');
    const body = await req.json().catch(() => ({}));
    const patch = body?.patch || {};

    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    for (const k of ['title', 'description', 'category', 'location', 'contact', 'photo_url']) {
      if (patch[k] !== undefined) payload[k] = patch[k];
    }
    if (patch.status !== undefined) payload.status = normalizeStatus(patch.status);
    if (patch.is_public !== undefined) payload.is_public = !!patch.is_public;
    if (patch.location_lat !== undefined) payload.location_lat = Number.isFinite(Number(patch.location_lat)) ? Number(patch.location_lat) : null;
    if (patch.location_lng !== undefined) payload.location_lng = Number.isFinite(Number(patch.location_lng)) ? Number(patch.location_lng) : null;

    const supabase = getServerSupabase();
    const up = await supabase.from('lost_found_items').update(payload).eq('id', id).select('*').single();
    if (up.error) throw up.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'LOST_FOUND_UPDATE',
          target_id: id,
          details: { keys: Object.keys(patch || {}) },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, item: up.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function DELETE(req: Request, ctx: any) {
  try {
    const { user } = await requireAdmin(req);
    const id = String(ctx?.params?.id || '');
    if (!id) throw new Error('BadRequest');
    const supabase = getServerSupabase();

    const del = await supabase.from('lost_found_items').delete().eq('id', id);
    if (del.error) throw del.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'LOST_FOUND_DELETE',
          target_id: id,
          details: {},
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
