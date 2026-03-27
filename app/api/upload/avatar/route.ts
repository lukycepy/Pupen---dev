import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import sharp from 'sharp';

function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function extFromFile(file: File) {
  const byName = (file.name.split('.').pop() || '').toLowerCase();
  if (byName && byName.length <= 8) return byName;
  const byType = (file.type || '').toLowerCase();
  if (byType === 'image/jpeg') return 'jpg';
  if (byType === 'image/png') return 'png';
  if (byType === 'image/webp') return 'webp';
  if (byType === 'image/gif') return 'gif';
  return 'bin';
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const form = await req.formData();
    const file = form.get('file');
    const generateAvif = form.get('generateAvif') !== 'false';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if ((file.type || '').toLowerCase().startsWith('image/') === false) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    if ((file.type || '').toLowerCase().includes('svg')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const supabase = getServerSupabase();
    const originalBytes = Buffer.from(await file.arrayBuffer());

    let bytes: any = originalBytes;
    let contentType = file.type || 'application/octet-stream';
    const path = `${user.id}/${Date.now()}-avatar.webp`;
    let avifPath: string | null = null;
    let avifPublicUrl: string | null = null;

    try {
      const base = sharp(originalBytes).resize({ width: 512, height: 512, fit: 'cover' });
      bytes = await base.clone().webp({ quality: 80, effort: 4 }).toBuffer();
      contentType = 'image/webp';
      if (generateAvif) {
        try {
          const avifBytes = await base.clone().avif({ quality: 60, effort: 4 }).toBuffer();
          avifPath = path.replace(/\.webp$/i, '.avif');
          const avifUpload = await supabase.storage.from('avatars').upload(avifPath, avifBytes, {
            upsert: true,
            contentType: 'image/avif',
          });
          if (!avifUpload.error) {
            avifPublicUrl = supabase.storage.from('avatars').getPublicUrl(avifPath).data.publicUrl;
          }
        } catch {}
      }
    } catch {}

    const upload = await supabase.storage.from('avatars').upload(path, bytes, {
      upsert: true,
      contentType,
    });
    if (upload.error) throw upload.error;

    const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;

    const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, bucket: 'avatars', path, publicUrl, variants: { avifPath, avifPublicUrl } });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
