import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const res = await supabase
      .from('newsletter')
      .select('id,created_at,subject,sent_at,target_count,open_count,click_count')
      .order('sent_at', { ascending: false })
      .limit(50);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, campaigns: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
