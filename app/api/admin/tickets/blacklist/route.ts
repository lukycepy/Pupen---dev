import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface TicketBlacklistEntry {
  value?: string | null;
  note?: string | null;
}

interface TicketBlacklistLogRow {
  created_at?: string | null;
  details?: {
    entries?: TicketBlacklistEntry[] | null;
  } | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, details')
      .eq('action', 'TICKET_EMAIL_BLACKLIST')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw res.error;

    const row = (res.data || null) as TicketBlacklistLogRow | null;
    const entries = Array.isArray(row?.details?.entries) ? row.details.entries : [];

    return NextResponse.json({ ok: true, updatedAt: row?.created_at || null, entries });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
