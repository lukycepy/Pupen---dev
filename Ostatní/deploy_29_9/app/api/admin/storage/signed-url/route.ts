import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExpiresIn(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value || 300);
  return Math.max(60, Math.min(60 * 60, Number.isFinite(parsed) ? parsed : 300));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const bucket = asTrimmedString(body.bucket);
    const path = asTrimmedString(body.path);
    const expiresIn = normalizeExpiresIn(body.expiresIn);
    if (!bucket || !path) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, signedUrl: res.data?.signedUrl || null, expiresIn });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
