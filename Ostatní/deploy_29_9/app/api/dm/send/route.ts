import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

interface DmSendBody {
  toId?: unknown;
  toEmail?: unknown;
  toLabel?: unknown;
  message?: unknown;
}

interface DmThreadBlockLookupRow {
  is_blocked?: boolean | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function threadIdFor(a: string, b: string) {
  return [a, b].sort().join(':');
}

export async function POST(req: Request) {
  try {
    const { user } = await requireMember(req);
    const g = await guardPublicJsonPost(req, {
      keyPrefix: `dm_send:${user.id}`,
      windowMs: 5 * 60 * 1000,
      max: 30,
      honeypot: false,
      tooManyMessage: 'Příliš mnoho zpráv. Zkuste to prosím později.',
    });
    if (!g.ok) return g.response;
    const body = toRecord(g.body) as DmSendBody;
    const { toId, toEmail, toLabel, message } = body;

    if (!toId || !toEmail || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const text = String(message).trim();
    if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    if (text.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

    const threadId = threadIdFor(String(user.id), String(toId));
    const now = new Date().toISOString();

    const supabase = getServerSupabase();

    try {
      const [p1, p2] = [String(user.id), String(toId)].sort();
      const p1Email = p1 === String(user.id) ? user.email : toEmail;
      const p2Email = p2 === String(user.id) ? user.email : toEmail;

      const { data: existingThread } = await supabase
        .from('dm_threads')
        .select('is_blocked')
        .eq('id', threadId)
        .single();

      if ((existingThread as DmThreadBlockLookupRow | null)?.is_blocked) {
        return NextResponse.json({ error: 'Thread is blocked' }, { status: 403 });
      }
      
      await supabase.from('dm_threads').upsert({
        id: threadId,
        participant1_id: p1,
        participant2_id: p2,
        participant1_email: p1Email,
        participant2_email: p2Email,
        last_message: text,
        last_message_at: now,
        updated_at: now
      }, { onConflict: 'id' });

      const pNum = p1 === String(toId) ? 1 : 2;
      const rpcRes = await supabase.rpc('increment_unread', { t_id: threadId, p_num: pNum });
      if (rpcRes.error) throw rpcRes.error;

      await supabase.from('dm_messages').insert({
        thread_id: threadId,
        sender_id: user.id,
        sender_email: user.email,
        content: text,
        created_at: now
      });
    } catch {}

    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'member',
        admin_name: String(toEmail),
        action: 'DM',
        target_id: threadId,
        details: {
          threadId,
          fromId: user.id,
          fromEmail: user.email,
          toId: String(toId),
          toEmail: String(toEmail),
          fromLabel: user.email,
          toLabel: toLabel ? String(toLabel) : String(toEmail),
          message: text,
          createdAt: now,
        },
      },
    ]);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, threadId });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
