import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const bucket = String(body?.bucket || '');
    const path = String(body?.path || '');
    const expiresIn = Math.max(60, Math.min(60 * 60, Number(body?.expiresIn || 300) || 300));
    if (!bucket || !path) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, signedUrl: res.data?.signedUrl || null, expiresIn });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

