import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

interface TrustBoxAttachmentSignedUrlBody {
  attachmentId?: unknown;
}

interface TrustBoxAttachmentStorageRow {
  bucket?: string | null;
  path?: string | null;
  thread_id?: string | number | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    const body = toRecord(await req.json().catch(() => ({}))) as TrustBoxAttachmentSignedUrlBody;
    const attachmentId = String(body.attachmentId || '').trim();
    if (!attachmentId) return NextResponse.json({ error: 'Missing attachmentId' }, { status: 400 });

    const supabase = getServerSupabase();
    const attRes = await supabase
      .from('trust_box_attachments')
      .select('bucket,path,thread_id')
      .eq('id', attachmentId)
      .maybeSingle<TrustBoxAttachmentStorageRow>();
    if (attRes.error) throw attRes.error;
    const att = attRes.data;
    if (!att?.bucket || !att?.path) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const signed = await supabase.storage.from(String(att.bucket)).createSignedUrl(String(att.path), 10 * 60);
    if (signed.error) throw signed.error;

    await logTrustBoxAudit({
      req,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email || null,
      action: 'ADMIN_DOWNLOAD_ATTACHMENT',
      threadId: att.thread_id == null ? null : String(att.thread_id),
      attachmentId,
      piiAccessed: true,
    });
    return NextResponse.json({ ok: true, url: signed.data?.signedUrl || null });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
