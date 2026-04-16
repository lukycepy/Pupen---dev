import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const email = user.email || '';
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getServerSupabase();
    
    // 1. Zkusíme načíst z nových tabulek (Dávka 06)
    try {
      const { data: dmData, error: dmErr } = await supabase
        .from('dm_threads')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('updated_at', { ascending: false })
        .limit(300);

      if (!dmErr && dmData) {
        // Formátujeme data z nové tabulky pro kompatibilitu s UI
        const threads = dmData.map((row: any) => {
          const isP1 = row.participant1_id === user.id;
          const peerId = isP1 ? row.participant2_id : row.participant1_id;
          const peerEmail = isP1 ? row.participant2_email : row.participant1_email;
          const unread = isP1 ? row.participant1_unread_count : row.participant2_unread_count;

          return {
            threadId: row.id,
            lastAt: row.last_message_at || row.updated_at,
            lastMessage: row.last_message || '',
            peerEmail,
            peerId,
            peerLabel: peerEmail, // Zatím fallback, v nové tabulce nemáme toLabel (lze získat joinem na users)
            unreadCount: unread,
            isBlocked: row.is_blocked
          };
        });

        // Pokud máme data z nové tabulky (nebo je prázdná ale tabulka existuje),
        // vrátíme to a přeskočíme admin_logs.
        // Tím je zajištěn plynulý přechod na doménové tabulky.
        return NextResponse.json({ ok: true, threads });
      }
    } catch (e) {
      console.warn('Fallback na admin_logs (dm_threads možná neexistuje):', e);
    }

    // 2. Fallback na admin_logs
    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, admin_email, admin_name, target_id, details')
      .eq('action', 'DM')
      .or(`admin_email.eq.${email},admin_name.eq.${email}`)
      .order('created_at', { ascending: false })
      .limit(300);

    if (res.error) throw res.error;

    const map = new Map<string, any>();
    for (const row of res.data || []) {
      const threadId = String(row.target_id || row.details?.threadId || '');
      if (!threadId) continue;
      if (map.has(threadId)) continue;

      const peerEmail = row.admin_email === email ? row.admin_name : row.admin_email;
      const peerId = row.details?.fromId === user.id ? row.details?.toId : row.details?.fromId;
      const peerLabel = row.details?.fromId === user.id ? row.details?.toLabel : row.details?.fromLabel;

      map.set(threadId, {
        threadId,
        lastAt: row.created_at,
        lastMessage: row.details?.message || '',
        peerEmail,
        peerId,
        peerLabel: peerLabel || peerEmail,
      });
    }

    const threads = Array.from(map.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    return NextResponse.json({ ok: true, threads });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
