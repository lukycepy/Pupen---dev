import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    if (!auth.isSuperadmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason || '').trim();
    if (reason.length < 10) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

    const supabase = getServerSupabase();
    const thr = await supabase.from('trust_box_threads').select('id, anonymized_at').eq('id', threadId).maybeSingle();
    if (thr.error) throw thr.error;
    if (!thr.data?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (thr.data?.anonymized_at) return NextResponse.json({ error: 'Anonymized' }, { status: 400 });

    const ident = await supabase
      .from('trust_box_identities')
      .select('first_name,last_name,email')
      .eq('thread_id', threadId)
      .maybeSingle();
    if (ident.error) throw ident.error;
    if (!ident.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await logTrustBoxAudit({
      req,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email || null,
      action: 'ADMIN_VIEW_PII',
      threadId,
      piiAccessed: true,
      reason,
    });

    return NextResponse.json({ ok: true, identity: ident.data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
