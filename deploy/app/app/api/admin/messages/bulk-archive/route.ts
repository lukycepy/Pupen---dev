import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const olderThanDaysRaw = body?.olderThanDays;
    const olderThanDays = Math.max(7, Math.min(3650, Number(olderThanDaysRaw || 30) || 30));
    
    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();

    const supabase = getServerSupabase();

    // Najdeme zprávy, které jsou starší než cutoff a nejsou ve stavu closed
    const { data: messagesToClose, error: selectError } = await supabase
      .from('messages')
      .select('id')
      .lt('created_at', cutoffIso)
      .neq('status', 'closed');

    if (selectError) throw selectError;

    const count = messagesToClose?.length || 0;

    if (count > 0) {
      const ids = messagesToClose.map(m => m.id);
      const { error: updateError } = await supabase
        .from('messages')
        .update({ status: 'closed' })
        .in('id', ids);

      if (updateError) throw updateError;
    }

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'MESSAGES_BULK_ARCHIVE',
          target_id: 'messages',
          details: { olderThanDays, cutoff: cutoffIso, archivedCount: count },
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true, olderThanDays, cutoff: cutoffIso, archivedCount: count });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}