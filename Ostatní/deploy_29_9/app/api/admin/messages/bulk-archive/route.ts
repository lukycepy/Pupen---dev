import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface BulkArchiveBody {
  olderThanDays?: unknown;
}

interface MessageIdRow {
  id?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = toRecord(await req.json().catch(() => ({}))) as BulkArchiveBody;
    const olderThanDaysRaw = body.olderThanDays;
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
      const ids = (messagesToClose as MessageIdRow[]).map((message) => message.id).filter(Boolean);
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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
