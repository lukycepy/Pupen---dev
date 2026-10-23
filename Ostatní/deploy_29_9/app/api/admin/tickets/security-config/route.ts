import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { DEFAULT_TICKET_SECURITY_CONFIG, normalizeTicketSecurityConfig } from '@/lib/tickets/securityConfig';

interface AdminLogRow {
  id?: number | null;
  created_at?: string | null;
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
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, details')
      .eq('action', 'TICKET_SECURITY_CONFIG')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<AdminLogRow>();
    if (res.error) throw res.error;

    const cfg = res.data?.details ? normalizeTicketSecurityConfig(toRecord(res.data.details).config) : DEFAULT_TICKET_SECURITY_CONFIG;
    return NextResponse.json({ ok: true, updatedAt: res.data?.created_at || null, config: cfg });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
