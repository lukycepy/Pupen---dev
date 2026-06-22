import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

const ITEM_STATUS = new Set(['open', 'claimed', 'in_progress', 'returned', 'archived']);
interface LostFoundPatchBody {
  patch?: unknown;
}

interface LostFoundPatchPayload {
  updated_at: string;
  title?: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  contact?: string | null;
  photo_url?: string | null;
  status?: string;
  is_public?: boolean;
  location_lat?: number | null;
  location_lng?: number | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeStatus(input: unknown) {
  const s = String(input || '').trim();
  return ITEM_STATUS.has(s) ? s : 'open';
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
    const body = toRecord(await req.json().catch(() => ({}))) as LostFoundPatchBody;
    const patch = toRecord(body.patch);

    const payload: LostFoundPatchPayload = {
      updated_at: new Date().toISOString(),
    };
    if (patch.title !== undefined) payload.title = String(patch.title).slice(0, 120);
    if (patch.description !== undefined) payload.description = patch.description ? String(patch.description).slice(0, 2000) : null;
    if (patch.category !== undefined) payload.category = patch.category ? String(patch.category).slice(0, 80) : null;
    if (patch.location !== undefined) payload.location = patch.location ? String(patch.location).slice(0, 120) : null;
    if (patch.contact !== undefined) payload.contact = patch.contact ? String(patch.contact).slice(0, 200) : null;
    if (patch.photo_url !== undefined) payload.photo_url = patch.photo_url ? String(patch.photo_url).slice(0, 500) : null;
    if (patch.status !== undefined) payload.status = normalizeStatus(patch.status);
    if (patch.is_public !== undefined) payload.is_public = !!patch.is_public;
    if (patch.location_lat !== undefined) payload.location_lat = Number.isFinite(Number(patch.location_lat)) ? Number(patch.location_lat) : null;
    if (patch.location_lng !== undefined) payload.location_lng = Number.isFinite(Number(patch.location_lng)) ? Number(patch.location_lng) : null;

    const supabase = getServerSupabase();
    const up = await supabase.from('lost_found_items').update(payload).eq('id', safeId).select('*').single();
    if (up.error) throw up.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'LOST_FOUND_UPDATE',
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

    const del = await supabase.from('lost_found_items').delete().eq('id', safeId);
    if (del.error) throw del.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'LOST_FOUND_DELETE',
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
