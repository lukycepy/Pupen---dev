import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

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
    for (const k of ['title', 'description', 'category', 'location', 'contact', 'status', 'photo_url']) {
      if (patch[k] !== undefined) payload[k] = patch[k];
    }
    if (patch.is_public !== undefined) payload.is_public = !!patch.is_public;

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

