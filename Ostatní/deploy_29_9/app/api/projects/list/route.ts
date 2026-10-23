import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, details')
      .eq('action', 'PROJECT')
      .order('created_at', { ascending: false })
      .limit(200);
    if (res.error) throw res.error;

    const rows = (res.data || []).map((r: any) => ({
      id: String(r.id),
      created_at: r.created_at,
      ...(r.details || {}),
    }));

    const filtered = rows.filter((p: any) => (p.kind || 'project') === 'project' && (p.status || 'open') !== 'archived');
    return NextResponse.json({ ok: true, projects: filtered });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: e?.message === 'Unauthorized' ? 401 : 500 });
  }
}

