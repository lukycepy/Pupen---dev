import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { getServerSupabase } from '@/lib/supabase-server';
import { membershipApplicationAdminChairAuthUploadSchema } from '@/lib/validations/membership-applications-admin';

export const runtime = 'nodejs';

function decodePngDataUrl(dataUrl: string): Buffer {
  const s = String(dataUrl || '').trim();
  const m = s.match(/^data:image\/png;base64,([a-z0-9+/=\s]+)$/i);
  if (!m?.[1]) throw new Error('Invalid signature');
  const b = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
  if (!b.length) throw new Error('Invalid signature');
  return b;
}

function extFromContentType(ct: string) {
  const c = String(ct || '').toLowerCase().trim();
  if (c.includes('png')) return 'png';
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg';
  if (c.includes('webp')) return 'webp';
  if (c.includes('gif')) return 'gif';
  return 'bin';
}

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) {
      const supabase = getServerSupabase();
      const perm = await supabase.from('profiles').select('can_edit_apps, can_manage_admins').eq('id', user.id).maybeSingle();
      if (perm.error) throw perm.error;
      const canEdit = !!(perm.data as any)?.can_edit_apps || !!(perm.data as any)?.can_manage_admins;
      if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const appRes = await rls.from('membership_applications_v2').select('status').eq('id', id).maybeSingle();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String((appRes.data as any).status || '') !== 'pending') return NextResponse.json({ error: 'Immutable' }, { status: 409 });

    const form = await req.formData();
    const kindRaw = String(form.get('kind') || '').trim();
    const kindParsed = membershipApplicationAdminChairAuthUploadSchema.safeParse({ kind: kindRaw });
    if (!kindParsed.success) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

    const kind = kindParsed.data.kind;
    const bucket = 'member_applications';
    let bytes: Buffer;
    let contentType: string;
    let fileName: string;

    if (kind === 'signature') {
      const dataUrl = String(form.get('dataUrl') || '').trim();
      bytes = decodePngDataUrl(dataUrl);
      contentType = 'image/png';
      fileName = 'chair_signature.png';
    } else {
      const f = form.get('file');
      if (!f || !(f instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
      if (!String(f.type || '').startsWith('image/')) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
      bytes = Buffer.from(await f.arrayBuffer());
      contentType = f.type || 'application/octet-stream';
      fileName = f.name || 'chair_stamp';
    }

    if (bytes.length > 3_000_000) return NextResponse.json({ error: 'File too large' }, { status: 413 });

    const ext = kind === 'signature' ? 'png' : extFromContentType(contentType);
    const fileId = randomUUID();
    const storagePath = `membership_applications_v2/${id}/chair_${kind}_${fileId}.${ext}`;

    const supabase = getServerSupabase();
    const up = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType, upsert: false });
    if (up.error) throw up.error;

    const ins = await rls
      .from('membership_application_files')
      .insert([
        {
          application_id: id,
          storage_bucket: bucket,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: contentType,
          size_bytes: bytes.length,
          meta: { kind: `chair_${kind}`, uploaded_by_email: user.email || null },
        },
      ])
      .select('id')
      .single();
    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true, fileId: ins.data?.id || null, kind });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

