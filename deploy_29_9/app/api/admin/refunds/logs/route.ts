import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface RefundLogListRow {
  id?: string | null;
  created_at?: string | null;
  admin_email?: string | null;
  action?: string | null;
  target_id?: string | null;
  details?: Record<string, unknown> | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 800), 1), 2000);

    const supabase = getServerSupabase();
    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, admin_email, action, target_id, details')
      .in('action', ['REFUND_REQUEST', 'REFUND_STATUS', 'REFUND_WORKFLOW', 'REFUND_EMAIL_SENT'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, rows: (res.data || []) as RefundLogListRow[] });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
