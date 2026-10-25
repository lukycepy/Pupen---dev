import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { MEMBERSHIP_APPLICATION_PDF_BUCKET } from '@/lib/membership-applications/pdf';

interface StoredFileRow {
  storage_bucket?: string | null;
  storage_path?: string | null;
}

interface MembershipApplicationAccessRow {
  id?: string | null;
  user_id?: string | null;
  email?: string | null;
}

interface MembershipApplicationSignedUrlBody {
  expiresIn?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const user = await requireUser(req);

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const body = toRecord(await req.json().catch(() => ({})));
    const payload = body as MembershipApplicationSignedUrlBody;
    const expiresIn = Math.max(60, Math.min(60 * 60, Number(payload.expiresIn || 600) || 600));
    const srv = getServerSupabase();

    const applicationRes = await srv
      .from('membership_applications_v2')
      .select('id,user_id,email')
      .eq('id', id)
      .maybeSingle<MembershipApplicationAccessRow>();
    if (applicationRes.error) throw applicationRes.error;
    const application = applicationRes.data;
    const userId = String(user.id || '').trim();
    const userEmail = String(user.email || '').trim().toLowerCase();
    const ownedByUserId = !!userId && String(application?.user_id || '').trim() === userId;
    const ownedByEmail = !!userEmail && String(application?.email || '').trim().toLowerCase() === userEmail;
    if (!application || (!ownedByUserId && !ownedByEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fileRes = await srv
      .from('membership_application_files')
      .select('storage_bucket, storage_path')
      .eq('application_id', id)
      .contains('meta', { kind: 'application_docx' })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<StoredFileRow>();
    if (fileRes.error) throw fileRes.error;
    if (!fileRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const bucket = String(fileRes.data.storage_bucket || MEMBERSHIP_APPLICATION_PDF_BUCKET).trim();
    const path = String(fileRes.data.storage_path || '').trim();
    if (!bucket || !path) return NextResponse.json({ error: 'Missing file' }, { status: 409 });

    const signed = await srv.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (signed.error) throw signed.error;

    return NextResponse.json({ ok: true, signedUrl: signed.data?.signedUrl || null, expiresIn });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
