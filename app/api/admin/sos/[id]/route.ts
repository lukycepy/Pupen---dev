import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface SosPatchBody {
  patch?: unknown;
}

interface SosPatchPayload {
  updated_at: string;
  title?: unknown;
  category?: unknown;
  phone?: unknown;
  email?: unknown;
  url?: unknown;
  note?: unknown;
  sort_order?: unknown;
  is_public?: boolean;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { id } = await ctx.params;
    const safeId = String(id || '').trim();
    if (!safeId) return NextResponse.json({ error: 'BadRequest' }, { status: 400 });
    const body = toRecord(await req.json().catch(() => ({}))) as SosPatchBody;
    const patch = toRecord(body.patch);

    const payload: SosPatchPayload = {
      updated_at: new Date().toISOString(),
    };
    if (patch.title !== undefined) payload.title = String(patch.title).slice(0, 120);
    if (patch.category !== undefined) payload.category = patch.category ? String(patch.category).slice(0, 80) : null;
    if (patch.phone !== undefined) payload.phone = patch.phone ? String(patch.phone).slice(0, 80) : null;
    if (patch.email !== undefined) payload.email = patch.email ? String(patch.email).slice(0, 120) : null;
    if (patch.url !== undefined) payload.url = patch.url ? String(patch.url).slice(0, 500) : null;
    if (patch.note !== undefined) payload.note = patch.note ? String(patch.note).slice(0, 500) : null;
    if (patch.sort_order !== undefined) payload.sort_order = Number.isFinite(Number(patch.sort_order)) ? Number(patch.sort_order) : 0;
    if (patch.is_public !== undefined) payload.is_public = !!patch.is_public;

    const supabase = getServerSupabase();
    const up = await supabase.from('sos_contacts').update(payload).eq('id', safeId).select('*').single();
    if (up.error) throw up.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'SOS_UPDATE',
          target_id: safeId,
          details: { keys: Object.keys(patch || {}) },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, item: up.data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { id } = await ctx.params;
    const safeId = String(id || '').trim();
    if (!safeId) return NextResponse.json({ error: 'BadRequest' }, { status: 400 });
    const supabase = getServerSupabase();

    const del = await supabase.from('sos_contacts').delete().eq('id', safeId);
    if (del.error) throw del.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'SOS_DELETE',
          target_id: safeId,
          details: {},
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
