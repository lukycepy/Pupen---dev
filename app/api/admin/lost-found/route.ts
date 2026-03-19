import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

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
      description: item.description ? String(item.description).slice(0, 2000) : null,
      category: item.category ? String(item.category).slice(0, 80) : null,
      location: item.location ? String(item.location).slice(0, 120) : null,
      contact: item.contact ? String(item.contact).slice(0, 200) : null,
      status: item.status ? String(item.status).slice(0, 40) : 'open',
      is_public: item.is_public !== false,
      photo_url: item.photo_url ? String(item.photo_url).slice(0, 500) : null,
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
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

