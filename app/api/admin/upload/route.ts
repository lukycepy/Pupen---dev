import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);

    const form = await req.formData();
    const file = form.get('file');
    const bucket = String(form.get('bucket') || 'images');
    const path = String(form.get('path') || '');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }
    if (bucket === 'member_applications' && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const bytes = new Uint8Array(await file.arrayBuffer());

    const upload = await supabase.storage.from(bucket).upload(path, bytes, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (upload.error) throw upload.error;

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ ok: true, bucket, path, publicUrl });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
