import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const deadId = String(id || '').trim();
    if (!deadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase.from('email_send_dead_letters').select('*').eq('id', deadId).maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, item: res.data });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

