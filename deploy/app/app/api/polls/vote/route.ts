import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export async function POST(req: Request) {
  try {
    const { user } = await requireMember(req);
    const g = await guardPublicJsonPost(req, {
      keyPrefix: `poll_vote:${user.id}`,
      windowMs: 10 * 60 * 1000,
      max: 30,
      honeypot: false,
      tooManyMessage: 'Příliš mnoho požadavků. Zkuste to prosím později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const pollId = String(body?.pollId || body?.poll_id || '').trim();
    const optionId = body?.optionId ? String(body.optionId).trim() : '';
    const optionIdsRaw = Array.isArray(body?.optionIds) ? body.optionIds : null;
    const optionIds = optionIdsRaw ? optionIdsRaw.map((x: any) => String(x).trim()).filter(Boolean) : [];
    if (!pollId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();

    const pollRes = await supabase
      .from('polls')
      .select('id,is_active,ends_at,allow_multiple')
      .eq('id', pollId)
      .maybeSingle();
    if (pollRes.error) throw pollRes.error;
    const poll: any = pollRes.data;
    if (!poll?.id) return NextResponse.json({ error: 'Invalid poll' }, { status: 400 });
    if (!poll.is_active) return NextResponse.json({ error: 'Poll is inactive' }, { status: 400 });
    if (poll.ends_at) {
      const exp = new Date(String(poll.ends_at));
      if (!Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Poll ended' }, { status: 400 });
      }
    }

    const existingVote = await supabase
      .from('poll_votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (existingVote.error) throw existingVote.error;
    if (existingVote.data?.id) return NextResponse.json({ ok: true, alreadyVoted: true });

    const selected = poll.allow_multiple ? optionIds : optionId ? [optionId] : [];
    const uniq = Array.from(new Set(selected)).filter(Boolean);
    if (uniq.length === 0) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const optionsRes = await supabase.from('poll_options').select('id, poll_id, votes').in('id', uniq);
    if (optionsRes.error) throw optionsRes.error;
    const rows = optionsRes.data || [];
    if (rows.length !== uniq.length) return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    if (rows.some((r: any) => String(r.poll_id) !== String(pollId))) return NextResponse.json({ error: 'Invalid option' }, { status: 400 });

    const voteInsert = await supabase.from('poll_votes').insert([
      {
        poll_id: pollId,
        user_id: user.id,
        option_ids: uniq,
        ip: g.ip === 'unknown' ? null : g.ip,
      },
    ]);
    if (voteInsert.error) throw voteInsert.error;

    for (const opt of rows as any[]) {
      const nextVotes = (opt.votes || 0) + 1;
      const upd = await supabase.from('poll_options').update({ votes: nextVotes }).eq('id', opt.id);
      if (upd.error) throw upd.error;
    }

    const log = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'member',
        admin_name: 'PollVote',
        action: 'POLL_VOTE',
        target_id: String(pollId),
        details: { userId: user.id, email: user.email, optionIds: uniq, createdAt: new Date().toISOString() },
      },
    ]);
    if (log.error) throw log.error;

    const full = await supabase.from('polls').select('*, poll_options(*)').eq('id', pollId).maybeSingle();
    if (full.error) throw full.error;

    return NextResponse.json({ ok: true, poll: full.data, alreadyVoted: false });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
