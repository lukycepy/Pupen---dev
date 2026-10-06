import { NextResponse } from 'next/server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface TrustBoxAuditRow {
  id?: string | number | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  action?: string | null;
  thread_id?: string | number | null;
  attachment_id?: string | number | null;
  pii_accessed?: boolean | null;
  reason?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
}

function normalizeLimit(input: unknown) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { isSuperadmin } = await requireTrustBoxAdmin(req);
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    
    if (!threadId && !isSuperadmin) {
      throw new Error('Forbidden');
    }

    const limit = normalizeLimit(searchParams.get('limit') || 100);
    const action = searchParams.get('action');
    const email = searchParams.get('email');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const supabase = getServerSupabase();
    let q = supabase
      .from('trust_box_audit_logs')
      .select('id,actor_user_id,actor_email,action,thread_id,attachment_id,pii_accessed,reason,ip,user_agent,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (threadId) q = q.eq('thread_id', threadId);
    if (action) q = q.eq('action', action);
    if (email) q = q.ilike('actor_email', `%${email}%`);
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo);

    const res = await q;
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, items: (res.data || []) as TrustBoxAuditRow[] });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });     
  }
}
