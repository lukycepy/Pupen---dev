import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { MEMBERSHIP_APPLICATION_PDF_BUCKET, ensureMembershipApplicationPdf, formatMembershipApplicationPdfFileName } from '@/lib/membership-applications/pdf';

interface MembershipApplicationRow {
  id?: string | null;
  created_at?: string | null;
  status?: string | null;
  meta?: Record<string, unknown> | null;
  email?: string | null;
}

interface StoredFileRow {
  storage_bucket?: string | null;
  storage_path?: string | null;
}

function cleanText(value: unknown) {
  return String(value || '').trim();
}

async function findLatestApplication(
  supabase: ReturnType<typeof getServerSupabase>,
  userId: string,
  email: string,
) {
  if (userId) {
    const byUser = await supabase
      .from('membership_applications_v2')
      .select('id,created_at,status,meta,email')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<MembershipApplicationRow>();
    if (byUser.error) throw byUser.error;
    if (byUser.data) return byUser.data;
  }

  if (email) {
    const byEmail = await supabase
      .from('membership_applications_v2')
      .select('id,created_at,status,meta,email')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<MembershipApplicationRow>();
    if (byEmail.error) throw byEmail.error;
    if (byEmail.data) return byEmail.data;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const userId = cleanText(user.id);
    const email = cleanText(user.email).toLowerCase();
    if (!userId && !email) return NextResponse.json({ error: 'Missing user identity' }, { status: 400 });

    const supabase = getServerSupabase();
    const app = await findLatestApplication(supabase, userId, email);
    if (!app?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let fileRes = await supabase
      .from('membership_application_files')
      .select('storage_bucket,storage_path')
      .eq('application_id', app.id)
      .contains('meta', { kind: 'application_pdf' })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<StoredFileRow>();
    if (fileRes.error) throw fileRes.error;
    if (!fileRes.data) {
      if (String(app.status || '') === 'pending') {
        return NextResponse.json({ error: 'Not decided' }, { status: 409 });
      }
      await ensureMembershipApplicationPdf({ applicationId: cleanText(app.id) });
      fileRes = await supabase
        .from('membership_application_files')
        .select('storage_bucket,storage_path')
        .eq('application_id', app.id)
        .contains('meta', { kind: 'application_pdf' })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<StoredFileRow>();
      if (fileRes.error) throw fileRes.error;
    }
    if (!fileRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const bucket = cleanText(fileRes.data.storage_bucket) || MEMBERSHIP_APPLICATION_PDF_BUCKET;
    const path = cleanText(fileRes.data.storage_path);
    if (!path) return NextResponse.json({ error: 'Missing file' }, { status: 409 });

    const download = await supabase.storage.from(bucket).download(path);
    if (download.error) throw download.error;
    const pdfBytes = Buffer.from(await download.data.arrayBuffer());
    const meta = app.meta && typeof app.meta === 'object' ? app.meta : {};
    const { utf8, ascii } = formatMembershipApplicationPdfFileName({
      firstName: meta?.first_name,
      lastName: meta?.last_name,
      createdAt: app.created_at,
    });

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`,
      },
    });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : msg === 'Not decided' ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
