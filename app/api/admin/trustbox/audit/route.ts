import { NextResponse } from 'next/server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function normalizeLimit(input: any) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(200, Math.floor(n)));
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
    return NextResponse.json({ ok: true, items: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });     
  }
}

