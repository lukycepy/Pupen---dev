import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface PromoUseLogRow {
  id?: string | null;
  created_at?: string | null;
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
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 2000), 1), 5000);

    const supabase = getServerSupabase();
    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, target_id, details')
      .eq('action', 'PROMO_USE')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, rows: (res.data || []) as PromoUseLogRow[] });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
