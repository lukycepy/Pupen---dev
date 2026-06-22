import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';

interface DmThreadListRow {
  id?: string | null;
  participant1_id?: string | null;
  participant2_id?: string | null;
  participant1_email?: string | null;
  participant2_email?: string | null;
  participant1_unread_count?: number | null;
  participant2_unread_count?: number | null;
  last_message_at?: string | null;
  updated_at?: string | null;
  last_message?: string | null;
  is_blocked?: boolean | null;
}

interface AdminLogThreadRow {
  id?: string | number | null;
  created_at?: string | null;
  admin_email?: string | null;
  admin_name?: string | null;
  target_id?: string | null;
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

    const supabase = getServerSupabase();
    
    try {
      const { data: dmData, error: dmErr } = await supabase
        .from('dm_threads')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('updated_at', { ascending: false })
        .limit(300);

      if (!dmErr && dmData) {
        const threads = (dmData as DmThreadListRow[]).map((row) => {
          const isP1 = row.participant1_id === user.id;
          const peerId = isP1 ? row.participant2_id : row.participant1_id;
          const peerEmail = isP1 ? row.participant2_email : row.participant1_email;
          const unread = Number(isP1 ? row.participant1_unread_count : row.participant2_unread_count) || 0;

          return {
            threadId: row.id || '',
            lastAt: row.last_message_at || row.updated_at || null,
            lastMessage: row.last_message || '',
            peerEmail: peerEmail || null,
            peerId: peerId || null,
            peerLabel: peerEmail || null,
            unreadCount: unread,
            isBlocked: row.is_blocked === true
          };
        });

        return NextResponse.json({ ok: true, threads });
      }
    } catch {}

    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, admin_email, admin_name, target_id, details')
      .eq('action', 'DM')
      .or(`admin_email.eq.${email},admin_name.eq.${email}`)
      .order('created_at', { ascending: false })
      .limit(300);

    if (res.error) throw res.error;

    const map = new Map<string, Record<string, unknown>>();
    for (const row of (res.data || []) as AdminLogThreadRow[]) {
      const details = toRecord(row.details);
      const threadId = String(row.target_id || details.threadId || '');
      if (!threadId) continue;
      if (map.has(threadId)) continue;

      const peerEmail = row.admin_email === email ? row.admin_name : row.admin_email;
      const fromId = details.fromId;
      const peerId = fromId === user.id ? details.toId : fromId;
      const peerLabel = fromId === user.id ? details.toLabel : details.fromLabel;

      map.set(threadId, {
        threadId,
        lastAt: row.created_at || null,
        lastMessage: typeof details.message === 'string' ? details.message : '',
        peerEmail: peerEmail || null,
        peerId: peerId ? String(peerId) : null,
        peerLabel: peerLabel ? String(peerLabel) : peerEmail || null,
      });
    }

    const threads = Array.from(map.values()).sort((a, b) => {
      const aTime = new Date(String(a.lastAt || '')).getTime();
      const bTime = new Date(String(b.lastAt || '')).getTime();
      return bTime - aTime;
    });
    return NextResponse.json({ ok: true, threads });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
