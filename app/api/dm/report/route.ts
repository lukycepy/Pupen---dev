import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

interface DmReportBody {
  messageId?: unknown;
  reason?: unknown;
}

interface DmReportedThreadRow {
  id?: string | null;
  participant1_id?: string | null;
  participant2_id?: string | null;
}

interface DmReportedMessageRow {
  id?: string | null;
  content?: string | null;
  dm_threads?: DmReportedThreadRow | DmReportedThreadRow[] | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getThreadRow(value: DmReportedMessageRow['dm_threads']) {
  if (Array.isArray(value)) return (value[0] || null) as DmReportedThreadRow | null;
  return (value || null) as DmReportedThreadRow | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireMember(req);
    const g = await guardPublicJsonPost(req, {
      keyPrefix: `dm_report:${user.id}`,
      windowMs: 10 * 60 * 1000,
      max: 10,
      honeypot: false,
      tooManyMessage: 'Příliš mnoho požadavků. Zkuste to prosím později.',
    });
    if (!g.ok) return g.response;
    const body = toRecord(g.body) as DmReportBody;
    const { messageId, reason } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: msgData, error: msgErr } = await supabase
      .from('dm_messages')
      .select('*, dm_threads!inner(*)')
      .eq('id', messageId)
      .single();

    if (msgErr || !msgData) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const messageRow = msgData as DmReportedMessageRow;
    const thread = getThreadRow(messageRow.dm_threads);
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    const isParticipant = thread.participant1_id === user.id || thread.participant2_id === user.id;

    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateErr } = await supabase
      .from('dm_messages')
      .update({ is_reported: true })
      .eq('id', messageId);

    if (updateErr) throw updateErr;

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
        content: messageRow.content || ''
      }
    }]);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
