import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

const ITEM_STATUS = new Set(['open', 'claimed', 'in_progress', 'returned', 'archived']);
interface LostFoundAdminBody {
  item?: unknown;
}

interface LostFoundItemPayload {
  updated_at: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  contact: string | null;
  status: string;
  is_public: boolean;
  photo_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
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

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('lost_found_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, items: res.data || [] });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = toRecord(await req.json().catch(() => ({}))) as LostFoundAdminBody;
    const item = toRecord(body.item);

    const payload: LostFoundItemPayload = {
      updated_at: new Date().toISOString(),
      title: String(item.title || '').slice(0, 120),
      description: item.description ? String(item.description).slice(0, 2000) : null,
      category: item.category ? String(item.category).slice(0, 80) : null,
      location: item.location ? String(item.location).slice(0, 120) : null,
      contact: item.contact ? String(item.contact).slice(0, 200) : null,
      status: normalizeStatus(item.status),
      is_public: item.is_public !== false,
      photo_url: item.photo_url ? String(item.photo_url).slice(0, 500) : null,
      location_lat: Number.isFinite(Number(item.location_lat)) ? Number(item.location_lat) : null,
      location_lng: Number.isFinite(Number(item.location_lng)) ? Number(item.location_lng) : null,
    };

    const supabase = getServerSupabase();
    const ins = await supabase.from('lost_found_items').insert([payload]).select('*').single();
    if (ins.error) throw ins.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'LOST_FOUND_CREATE',
          target_id: String(ins.data?.id || ''),
          details: { title: payload.title },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, item: ins.data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
