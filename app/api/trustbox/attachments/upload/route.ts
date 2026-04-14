import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicPostNoBody } from '@/lib/public-post-guard';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function safeName(input: string) {
  const s = String(input || '').trim().slice(0, 180);
  return s || 'file';
}

function isAllowedContentType(ct: string) {
  const v = String(ct || '').toLowerCase();
  if (!v) return false;
  if (v === 'image/svg+xml') return false;
  if (v.startsWith('image/')) return true;
  if (v.startsWith('audio/')) return true;
  if (v === 'application/pdf') return true;
  if (v === 'application/zip') return true;
  if (v === 'application/x-zip-compressed') return true;
  if (v === 'application/vnd.rar') return true;
  if (v === 'application/x-rar-compressed') return true;
  if (v === 'application/x-7z-compressed') return true;
  if (v === 'application/msword') return true;
  if (v === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  if (v === 'application/vnd.ms-excel') return true;
  if (v === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return true;
  if (v === 'text/plain') return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicPostNoBody(req, { keyPrefix: 'trustbox_upload', windowMs: 60_000, max: 20 });
    if (!g.ok) return g.response;

    const form = await req.formData();
    const token = String(form.get('token') || '').trim();
    const file = form.get('file');
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const f: File = file as any;
    const contentType = String(f.type || '').toLowerCase();
    if (!isAllowedContentType(contentType)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    if (f.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large' }, { status: 400 });

    const supabase = getServerSupabase();
    const tokenHash = sha256Hex(token);
    const v = await supabase
      .from('trust_box_verifications')
      .select('id, expires_at, verified_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (v.error) throw v.error;
    const row: any = v.data;
    if (!row || row.verified_at) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    const bytes = new Uint8Array(await f.arrayBuffer());
    const path = `verifications/${row.id}/${randomUUID()}`;
    const up = await supabase.storage.from('trustbox_attachments').upload(path, bytes, { contentType, upsert: false });
    if (up.error) throw up.error;

    const ins = await supabase
      .from('trust_box_verification_attachments')
      .insert([
        {
          verification_id: row.id,
          bucket: 'trustbox_attachments',
          path,
          original_name: safeName(f.name),
          content_type: contentType,
          size_bytes: f.size,
        },
      ])
      .select('id')
      .single();
    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true, attachmentId: ins.data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

