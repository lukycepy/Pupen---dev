import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();

    const pollRes = await supabase
      .from('polls')
      .select('*, poll_options(*)')
      .eq('is_active', true)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollRes.error) throw pollRes.error;
    const poll = pollRes.data;
    if (!poll) return NextResponse.json({ ok: true, poll: null, voted: false });

    const voteRes = await supabase
      .from('poll_votes')
      .select('id')
      .eq('poll_id', String(poll.id))
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (voteRes.error) throw voteRes.error;
    const voted = !!voteRes.data?.id;
    return NextResponse.json({ ok: true, poll, voted });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
