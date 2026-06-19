import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { getServerSupabase } from '@/lib/supabase-server';

interface StoredFileRow {
  storage_bucket?: string | null;
  storage_path?: string | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const expiresIn = Math.max(60, Math.min(60 * 60, Number(body?.expiresIn || 600) || 600));

    const fileRes = await rls
      .from('membership_application_files')
      .select('storage_bucket, storage_path')
      .eq('application_id', id)
      .contains('meta', { kind: 'applicant_signature' })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<StoredFileRow>();
    if (fileRes.error) throw fileRes.error;
    if (!fileRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const bucket = String(fileRes.data?.storage_bucket || '').trim();
    const path = String(fileRes.data?.storage_path || '').trim();
    if (!bucket || !path) return NextResponse.json({ error: 'Missing file' }, { status: 409 });

    const srv = getServerSupabase();
    const signed = await srv.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (signed.error) throw signed.error;

    return NextResponse.json({ ok: true, signedUrl: signed.data?.signedUrl || null, expiresIn });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
