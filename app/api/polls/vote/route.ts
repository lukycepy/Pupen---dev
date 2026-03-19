import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `poll_vote:${user.id}:${ip}`, windowMs: 10 * 60 * 1000, max: 30 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { pollId, optionId } = body || {};
    if (!pollId || !optionId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();

    const already = await supabase
      .from('admin_logs')
      .select('id')
      .eq('action', 'POLL_VOTE')
      .eq('target_id', String(pollId))
      .eq('details->>userId', user.id)
      .limit(1)
      .maybeSingle();
    if (already.error) throw already.error;
    if (already.data) return NextResponse.json({ ok: true, alreadyVoted: true });

    const optRes = await supabase
      .from('poll_options')
      .select('id, poll_id, votes')
      .eq('id', optionId)
      .maybeSingle();
    if (optRes.error) throw optRes.error;
    if (!optRes.data || String(optRes.data.poll_id) !== String(pollId)) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    }

    const nextVotes = (optRes.data.votes || 0) + 1;
    const upd = await supabase.from('poll_options').update({ votes: nextVotes }).eq('id', optionId);
    if (upd.error) throw upd.error;

    const log = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'member',
        admin_name: 'PollVote',
        action: 'POLL_VOTE',
        target_id: String(pollId),
        details: { userId: user.id, email: user.email, optionId: String(optionId), createdAt: new Date().toISOString() },
      },
    ]);
    if (log.error) throw log.error;

    const pollRes = await supabase.from('polls').select('*, poll_options(*)').eq('id', pollId).maybeSingle();
    if (pollRes.error) throw pollRes.error;

    return NextResponse.json({ ok: true, poll: pollRes.data, alreadyVoted: false });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
