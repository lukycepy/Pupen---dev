import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export const runtime = 'nodejs';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'trustbox_attachment_signed_url',
      windowMs: 60_000,
      max: 60,
      honeypotResponse: { ok: true },
    });
    if (!g.ok) return g.response;
    const body = g.body || {};
    const token = String(body?.token || '').trim();
    const attachmentId = String(body?.attachmentId || '').trim();
    if (!token || !attachmentId) return NextResponse.json({ error: 'Missing token/attachmentId' }, { status: 400 });

    const supabase = getServerSupabase();
    const tokenHash = sha256Hex(token);
    const tok = await supabase
      .from('trust_box_access_tokens')
      .select('thread_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (tok.error) throw tok.error;
    const row: any = tok.data;
    if (!row?.thread_id) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    const attRes = await supabase
      .from('trust_box_attachments')
      .select('id, bucket, path, thread_id')
      .eq('id', attachmentId)
      .maybeSingle();
    if (attRes.error) throw attRes.error;
    const att: any = attRes.data;
    if (!att?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String(att.thread_id) !== String(row.thread_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const signed = await supabase.storage.from(String(att.bucket)).createSignedUrl(String(att.path), 60 * 10);
    if (signed.error) throw signed.error;

    return NextResponse.json({ ok: true, url: signed.data?.signedUrl || '' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

