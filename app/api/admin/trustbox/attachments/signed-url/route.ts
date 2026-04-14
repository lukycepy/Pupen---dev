import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

export async function POST(req: Request) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    const body = await req.json().catch(() => ({}));
    const attachmentId = String(body?.attachmentId || '').trim();
    if (!attachmentId) return NextResponse.json({ error: 'Missing attachmentId' }, { status: 400 });

    const supabase = getServerSupabase();
    const attRes = await supabase
      .from('trust_box_attachments')
      .select('bucket,path,thread_id')
      .eq('id', attachmentId)
      .maybeSingle();
    if (attRes.error) throw attRes.error;
    const att: any = attRes.data;
    if (!att?.bucket || !att?.path) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const signed = await supabase.storage.from(String(att.bucket)).createSignedUrl(String(att.path), 10 * 60);
    if (signed.error) throw signed.error;

    await logTrustBoxAudit({
      req,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email || null,
      action: 'ADMIN_DOWNLOAD_ATTACHMENT',
      threadId: att.thread_id || null,
      attachmentId,
      piiAccessed: true,
    });
    return NextResponse.json({ ok: true, url: signed.data?.signedUrl || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
