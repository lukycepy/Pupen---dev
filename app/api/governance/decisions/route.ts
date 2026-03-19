import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('governance_decisions')
      .select('id, created_at, meeting_id, meeting_title, title, summary_html, status, decided_at')
      .eq('is_published', true)
      .order('decided_at', { ascending: false })
      .limit(300);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, decisions: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

