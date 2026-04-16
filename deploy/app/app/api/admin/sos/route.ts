import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('sos_contacts')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(500);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, items: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const item = body?.item || {};

    const payload: any = {
      updated_at: new Date().toISOString(),
      title: String(item.title || '').slice(0, 120),
      category: item.category ? String(item.category).slice(0, 80) : null,
      phone: item.phone ? String(item.phone).slice(0, 80) : null,
      email: item.email ? String(item.email).slice(0, 120) : null,
      url: item.url ? String(item.url).slice(0, 500) : null,
      note: item.note ? String(item.note).slice(0, 500) : null,
      is_public: item.is_public !== false,
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
    };

    const supabase = getServerSupabase();
    const ins = await supabase.from('sos_contacts').insert([payload]).select('*').single();
    if (ins.error) throw ins.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'SOS_CREATE',
          target_id: String(ins.data?.id || ''),
          details: { title: payload.title },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, item: ins.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

