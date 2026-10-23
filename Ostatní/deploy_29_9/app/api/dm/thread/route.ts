import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';

interface DmThreadRow {
  id?: string | null;
  participant1_id?: string | null;
  participant2_id?: string | null;
  participant1_email?: string | null;
  participant2_email?: string | null;
  participant1_unread_count?: number | null;
  participant2_unread_count?: number | null;
}

interface DmMessageRow {
  id?: string | null;
  created_at?: string | null;
  sender_email?: string | null;
  sender_id?: string | null;
  content?: string | null;
  is_read?: boolean | null;
}

interface AdminLogDmRow {
  id?: string | number | null;
  created_at?: string | null;
  admin_email?: string | null;
  admin_name?: string | null;
  details?: Record<string, unknown> | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const email = user.email || '';
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    if (!threadId) return NextResponse.json({ error: 'Missing threadId' }, { status: 400 });

    const supabase = getServerSupabase();

    // 1. Zkusíme načíst z nových doménových tabulek (Dávka 06)
    try {
      const { data: dmData, error: dmErr } = await supabase
        .from('dm_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(300);

      if (!dmErr && dmData && dmData.length > 0) {
        const { data: threadData } = await supabase
          .from('dm_threads')
          .select('*')
          .eq('id', threadId)
          .single();

        if (threadData) {
          const thread = threadData as DmThreadRow;
          const isP1 = thread.participant1_id === user.id;
          const isP2 = thread.participant2_id === user.id;

          if (!isP1 && !isP2) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }

          if (isP1 && Number(thread.participant1_unread_count || 0) > 0) {
            await supabase.from('dm_threads').update({ participant1_unread_count: 0 }).eq('id', threadId);
          } else if (isP2 && Number(thread.participant2_unread_count || 0) > 0) {
            await supabase.from('dm_threads').update({ participant2_unread_count: 0 }).eq('id', threadId);
          }

          const messages = (dmData as DmMessageRow[]).map((messageRow) => ({
            id: String(messageRow.id || ''),
            createdAt: messageRow.created_at || null,
            fromEmail: messageRow.sender_email || null,
            toEmail: messageRow.sender_id === thread.participant1_id ? thread.participant2_email || null : thread.participant1_email || null,
            message: messageRow.content || '',
            isRead: messageRow.is_read === true
          }));

          await supabase
            .from('dm_messages')
            .update({ is_read: true })
            .eq('thread_id', threadId)
            .neq('sender_id', user.id)
            .eq('is_read', false);

          return NextResponse.json({ ok: true, messages });
        }
      }
    } catch {}

    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, admin_email, admin_name, details')
      .eq('action', 'DM')
      .eq('target_id', threadId)
      .order('created_at', { ascending: true })
      .limit(300);
    if (res.error) throw res.error;

    const rows = (res.data || []) as AdminLogDmRow[];
    const allowed = rows.some((row) => row.admin_email === email || row.admin_name === email);
    if (rows.length > 0 && !allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const messages = rows.map((row) => {
      const details = toRecord(row.details);
      return {
        id: String(row.id || ''),
        createdAt: row.created_at || null,
        fromEmail: row.admin_email || null,
        toEmail: row.admin_name || null,
        message: typeof details.message === 'string' ? details.message : '',
      };
    });

    return NextResponse.json({ ok: true, messages });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
