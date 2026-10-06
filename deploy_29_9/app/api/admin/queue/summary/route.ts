import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface CountResponse {
  count: number | null;
  error: Error | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();
    const stuckIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const [queued, retry, processing, dueNow, stuckProcessing, dead] = await Promise.all([
      supabase.from('email_send_queue').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
      supabase.from('email_send_queue').select('id', { count: 'exact', head: true }).eq('status', 'retry'),
      supabase.from('email_send_queue').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('email_send_queue').select('id', { count: 'exact', head: true }).in('status', ['queued', 'retry']).lte('next_attempt_at', nowIso),
      supabase
        .from('email_send_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'processing')
        .lt('locked_at', stuckIso),
      supabase.from('email_send_dead_letters').select('id', { count: 'exact', head: true }),
    ]);

    for (const response of [queued, retry, processing, dueNow, stuckProcessing, dead] as CountResponse[]) {
      if (response.error) throw response.error;
    }

    return NextResponse.json({
      ok: true,
      queue: {
        queued: Number(queued.count || 0),
        retry: Number(retry.count || 0),
        processing: Number(processing.count || 0),
        dueNow: Number(dueNow.count || 0),
        stuckProcessing: Number(stuckProcessing.count || 0),
      },
      deadLetters: {
        total: Number(dead.count || 0),
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
