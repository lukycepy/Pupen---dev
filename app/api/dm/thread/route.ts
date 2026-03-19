import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
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
        // Zkontrolovat, zda uživatel má přístup (zda je účastníkem threadu)
        const { data: threadData } = await supabase
          .from('dm_threads')
          .select('*')
          .eq('id', threadId)
          .single();

        if (threadData) {
          const isP1 = threadData.participant1_id === user.id;
          const isP2 = threadData.participant2_id === user.id;

          if (!isP1 && !isP2) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }

          // Reset unread count pro aktuálního uživatele
          if (isP1 && threadData.participant1_unread_count > 0) {
            await supabase.from('dm_threads').update({ participant1_unread_count: 0 }).eq('id', threadId);
          } else if (isP2 && threadData.participant2_unread_count > 0) {
            await supabase.from('dm_threads').update({ participant2_unread_count: 0 }).eq('id', threadId);
          }

          const messages = dmData.map((r: any) => ({
            id: String(r.id),
            createdAt: r.created_at,
            fromEmail: r.sender_email,
            toEmail: r.sender_id === threadData.participant1_id ? threadData.participant2_email : threadData.participant1_email,
            message: r.content,
            isRead: r.is_read
          }));

          // Označit zprávy jako přečtené (kde nejsme odesílatel)
          await supabase
            .from('dm_messages')
            .update({ is_read: true })
            .eq('thread_id', threadId)
            .neq('sender_id', user.id)
            .eq('is_read', false);

          return NextResponse.json({ ok: true, messages });
        }
      }
    } catch (e) {
      console.warn('Fallback na admin_logs (dm_messages možná neexistuje):', e);
    }

    // 2. Fallback na admin_logs
    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, admin_email, admin_name, details')
      .eq('action', 'DM')
      .eq('target_id', threadId)
      .order('created_at', { ascending: true })
      .limit(300);
    if (res.error) throw res.error;

    const rows = res.data || [];
    const allowed = rows.some((r: any) => r.admin_email === email || r.admin_name === email);
    if (rows.length > 0 && !allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const messages = rows.map((r: any) => ({
      id: String(r.id),
      createdAt: r.created_at,
      fromEmail: r.admin_email,
      toEmail: r.admin_name,
      message: r.details?.message || '',
    }));

    return NextResponse.json({ ok: true, messages });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

