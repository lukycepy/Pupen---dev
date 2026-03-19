import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const supabase = getServerSupabase();

    const pollRes = await supabase
      .from('polls')
      .select('*, poll_options(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollRes.error) throw pollRes.error;
    const poll = pollRes.data;
    if (!poll) return NextResponse.json({ ok: true, poll: null, voted: false });

    const voteRes = await supabase
      .from('admin_logs')
      .select('id')
      .eq('action', 'POLL_VOTE')
      .eq('target_id', String(poll.id))
      .eq('details->>userId', user.id)
      .limit(1)
      .maybeSingle();

    const voted = !!voteRes.data;
    return NextResponse.json({ ok: true, poll, voted });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

