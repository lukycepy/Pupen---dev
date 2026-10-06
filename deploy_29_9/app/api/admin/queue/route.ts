import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

type QueueView = 'queue' | 'dead';

interface EmailQueueListRow {
  id?: string | null;
  status?: string | null;
  to_email?: string | null;
  from_email?: string | null;
  reply_to?: string | null;
  subject?: string | null;
  meta?: Record<string, unknown> | null;
  attempt_count?: number | null;
  max_attempts?: number | null;
  last_error?: string | null;
  next_attempt_at?: string | null;
  locked_at?: string | null;
  locked_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface EmailDeadLetterRow {
  id?: string | null;
  queue_id?: string | null;
  to_email?: string | null;
  from_email?: string | null;
  reply_to?: string | null;
  subject?: string | null;
  meta?: Record<string, unknown> | null;
  attempt_count?: number | null;
  max_attempts?: number | null;
  final_error?: string | null;
  failed_at?: string | null;
  created_at?: string | null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const view: QueueView = url.searchParams.get('view') === 'dead' ? 'dead' : 'queue';
    const status = String(url.searchParams.get('status') || '').trim();
    const kind = String(url.searchParams.get('kind') || '').trim();
    const dueOnly = String(url.searchParams.get('due') || '').trim() === '1';
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const limit = clamp(Number(url.searchParams.get('limit') || 50) || 50, 1, 200);
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);

    const supabase = getServerSupabase();

    if (view === 'dead') {
      let query = supabase
        .from('email_send_dead_letters')
        .select('id,queue_id,to_email,from_email,reply_to,subject,meta,attempt_count,max_attempts,final_error,failed_at,created_at', { count: 'exact' })
        .order('failed_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (q) {
        query = query.or(
          `to_email.ilike.%${q}%,from_email.ilike.%${q}%,subject.ilike.%${q}%,final_error.ilike.%${q}%`,
        );
      }

      if (kind) {
        query = query.filter('meta->>kind', 'eq', kind);
      }

      const res = await query;
      if (res.error) throw res.error;
      return NextResponse.json({ ok: true, view, items: (res.data || []) as EmailDeadLetterRow[], count: Number(res.count || 0) });
    }

    let query = supabase
      .from('email_send_queue')
      .select('id,status,to_email,from_email,reply_to,subject,meta,attempt_count,max_attempts,last_error,next_attempt_at,locked_at,locked_by,created_at,updated_at', { count: 'exact' })
      .order('next_attempt_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (kind) query = query.filter('meta->>kind', 'eq', kind);
    if (dueOnly) query = query.lte('next_attempt_at', new Date().toISOString());
    if (q) {
      query = query.or(`to_email.ilike.%${q}%,from_email.ilike.%${q}%,subject.ilike.%${q}%,last_error.ilike.%${q}%`);
    }

    const res = await query;
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, view, items: (res.data || []) as EmailQueueListRow[], count: Number(res.count || 0) });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
