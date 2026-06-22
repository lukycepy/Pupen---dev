import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface InvoiceLogRow {
  id?: string | null;
  created_at?: string | null;
  admin_email?: string | null;
  admin_name?: string | null;
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
    const statusRows = await supabase
      .from('admin_logs')
      .select('id, created_at, admin_email, admin_name, action, target_id, details')
      .eq('action', 'INVOICE_STATUS')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (statusRows.error) throw statusRows.error;

    const requestRows = await supabase
      .from('admin_logs')
      .select('id, created_at, admin_email, admin_name, action, target_id, details')
      .ilike('action', 'Žádost o fakturu:%')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (requestRows.error) throw requestRows.error;

    return NextResponse.json({
      ok: true,
      requests: (requestRows.data || []) as InvoiceLogRow[],
      statuses: (statusRows.data || []) as InvoiceLogRow[],
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
