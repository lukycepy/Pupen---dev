import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `dm_report:${user.id}:${ip}`, windowMs: 10 * 60 * 1000, max: 10 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { messageId, reason } = body || {};

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Najít zprávu
    const { data: msgData, error: msgErr } = await supabase
      .from('dm_messages')
      .select('*, dm_threads!inner(*)')
      .eq('id', messageId)
      .single();

    if (msgErr || !msgData) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const thread = msgData.dm_threads;
    const isParticipant = thread.participant1_id === user.id || thread.participant2_id === user.id;

    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Označit jako nahlášené
    const { error: updateErr } = await supabase
      .from('dm_messages')
      .update({ is_reported: true })
      .eq('id', messageId);

    if (updateErr) throw updateErr;

    // Log do admin_logs pro moderátory
    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'member',
      admin_name: 'System',
      action: 'DM_REPORT',
      target_id: messageId,
      details: {
        messageId,
        threadId: thread.id,
        reportedBy: user.id,
        reason: reason || 'No reason provided',
        content: msgData.content
      }
    }]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
