import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { DEFAULT_TICKET_SECURITY_CONFIG, normalizeTicketSecurityConfig } from '@/lib/tickets/securityConfig';

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
      .maybeSingle();
    if (res.error) throw res.error;

    const cfg = res.data?.details?.config ? normalizeTicketSecurityConfig(res.data.details.config) : DEFAULT_TICKET_SECURITY_CONFIG;
    return NextResponse.json({ ok: true, updatedAt: res.data?.created_at || null, config: cfg });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

