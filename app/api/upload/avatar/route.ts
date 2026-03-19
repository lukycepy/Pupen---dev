import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

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

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if ((file.type || '').toLowerCase().startsWith('image/') === false) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const ext = extFromFile(file);
    const name = safeFileName(file.name);
    const path = `${user.id}/${Date.now()}-${name || 'avatar'}.${ext}`;

    const supabase = getServerSupabase();
    const bytes = new Uint8Array(await file.arrayBuffer());

    const upload = await supabase.storage.from('avatars').upload(path, bytes, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (upload.error) throw upload.error;

    const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;

    const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, bucket: 'avatars', path, publicUrl });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

