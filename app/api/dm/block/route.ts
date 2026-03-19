import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `dm_block:${user.id}:${ip}`, windowMs: 10 * 60 * 1000, max: 30 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { threadId, action } = body || {};

    if (!threadId || !action) {
      return NextResponse.json({ error: 'Missing threadId or action' }, { status: 400 });
    }

    if (action !== 'block' && action !== 'unblock') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Zkontrolujeme, že vlákno existuje a uživatel je účastníkem
    const { data: threadData, error: threadErr } = await supabase
      .from('dm_threads')
      .select('*')
      .eq('id', threadId)
      .single();

    if (threadErr || !threadData) {
      // Pokud tabulka neexistuje nebo vlákno nenalezeno
      return NextResponse.json({ error: 'Thread not found or tables not migrated yet' }, { status: 404 });
    }

    const isP1 = threadData.participant1_id === user.id;
    const isP2 = threadData.participant2_id === user.id;

    if (!isP1 && !isP2) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Aplikujeme blokaci
    const isBlocked = action === 'block';
    const blockedBy = isBlocked ? user.id : null;

    const { error: updateErr } = await supabase
      .from('dm_threads')
      .update({ is_blocked: isBlocked, blocked_by: blockedBy })
      .eq('id', threadId);

    if (updateErr) throw updateErr;

    // Záznam do audit logu
    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'member',
      admin_name: 'System',
      action: isBlocked ? 'DM_BLOCK' : 'DM_UNBLOCK',
      target_id: threadId,
      details: { threadId, by: user.id }
    }]);

    return NextResponse.json({ ok: true, isBlocked });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
