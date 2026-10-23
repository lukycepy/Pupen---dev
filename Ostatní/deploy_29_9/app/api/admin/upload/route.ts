import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import sharp from 'sharp';

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);

    const form = await req.formData();
    const file = form.get('file');
    const bucket = String(form.get('bucket') || 'images');
    const originalPath = String(form.get('path') || '');
    const autoCompress = form.get('autoCompress') !== 'false';
    const generateAvif = form.get('generateAvif') !== 'false';
    const isGallery = bucket === 'gallery' || originalPath.includes('gallery/');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (!originalPath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }
    if (bucket === 'member_applications' && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const originalBytes: any = Buffer.from(await file.arrayBuffer());
    let bytes: any = originalBytes;
    let contentType = file.type || 'application/octet-stream';
    let path = originalPath;
    let avifPath: string | null = null;
    let avifPublicUrl: string | null = null;

    // Image optimization pipeline
    if (autoCompress && file.type.startsWith('image/') && !file.type.includes('svg')) {
      try {
        // Zvýšená komprese pro galerii
        const maxWidth = isGallery ? 1200 : 2000;
        const maxHeight = isGallery ? 1200 : 2000;
        const quality = isGallery ? 70 : 80;
        const avifQuality = isGallery ? 55 : 60;

        const base = sharp(originalBytes)
          .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
        
        const webpBytes = await base.clone().webp({ quality, effort: 4 }).toBuffer();
        bytes = webpBytes;
        
        contentType = 'image/webp';
        // Replace extension with .webp
        path = path.replace(/\.[^/.]+$/, '.webp');

        if (generateAvif) {
          try {
            const avifBytes = await base.clone().avif({ quality: avifQuality, effort: 4 }).toBuffer();
            avifPath = path.replace(/\.webp$/i, '.avif');
            const avifUpload = await supabase.storage.from(bucket).upload(avifPath, avifBytes, {
              upsert: true,
              contentType: 'image/avif',
            });
            if (!avifUpload.error) {
              avifPublicUrl = supabase.storage.from(bucket).getPublicUrl(avifPath).data.publicUrl;
            }
          } catch {}
        }
      } catch (err) {
        console.error('Sharp optimization failed, falling back to original:', err);
      }
    }

    const upload = await supabase.storage.from(bucket).upload(path, bytes, {
      upsert: true,
      contentType: contentType,
    });
    if (upload.error) throw upload.error;

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: 'Admin API',
      action: 'UPLOAD_FILE',
      target_id: path,
      details: { bucket, size: bytes.length, type: contentType, optimized: path !== originalPath, avif_path: avifPath, avif: !!avifPublicUrl }
    }]);

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ ok: true, bucket, path, publicUrl, originalPath, variants: { avifPath, avifPublicUrl } });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
