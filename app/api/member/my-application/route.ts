import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationRow {
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  motivation?: string | null;
  faculty?: string | null;
  signature_data_url?: string | null;
  meta?: JsonRecord | null;
}

interface MembershipApplicationFileRow {
  id?: string | number | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  meta?: JsonRecord | null;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function cleanText(value: unknown) {
  return String(value || '').trim();
}

function getFileKind(file: MembershipApplicationFileRow | null | undefined) {
  return String(file?.meta?.kind || '').trim();
}

function findLatestFileByKind(files: MembershipApplicationFileRow[], kind: string) {
  return files.find((file) => getFileKind(file) === kind) || null;
}

async function createSignedUrl(
  supabase: ReturnType<typeof getServerSupabase>,
  file: MembershipApplicationFileRow | null,
  expiresIn = 600,
) {
  const bucket = cleanText(file?.storage_bucket);
  const path = cleanText(file?.storage_path);
  if (!bucket || !path) return null;
  const signed = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (signed.error) return null;
  return cleanText(signed.data?.signedUrl) || null;
}

async function findLatestApplication(
  supabase: ReturnType<typeof getServerSupabase>,
  userId: string,
  email: string,
) {
  if (userId) {
    const byUser = await supabase
      .from('membership_applications_v2')
      .select('*')
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
      .select('*')
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
    if (!userId && !email) return NextResponse.json({ ok: true, application: null });

    const supabase = getServerSupabase();
    const application = await findLatestApplication(supabase, userId, email);
    if (!application?.id) return NextResponse.json({ ok: true, application: null });

    const filesRes = await supabase
      .from('membership_application_files')
      .select('id,storage_bucket,storage_path,meta')
      .eq('application_id', application.id)
      .order('created_at', { ascending: false });
    if (filesRes.error) throw filesRes.error;
    const files = Array.isArray(filesRes.data) ? (filesRes.data as MembershipApplicationFileRow[]) : [];

    const meta = toRecord(application.meta);
    const decision = toRecord(meta.decision);
    const chairAuthFileId = cleanText(decision.chair_auth_file_id);

    const applicantSignatureFile = findLatestFileByKind(files, 'applicant_signature');
    const chairAuthFile =
      files.find((file) => cleanText(file.id) === chairAuthFileId) ||
      findLatestFileByKind(files, 'chair_signature') ||
      findLatestFileByKind(files, 'chair_stamp');
    const docxFile = findLatestFileByKind(files, 'application_docx');
    const pdfFile = findLatestFileByKind(files, 'application_pdf');

    const [applicantSignatureUrl, chairAuthUrl] = await Promise.all([
      createSignedUrl(supabase, applicantSignatureFile),
      createSignedUrl(supabase, chairAuthFile),
    ]);

    return NextResponse.json({
      ok: true,
      application: {
        ...application,
        first_name: cleanText(meta.first_name) || null,
        last_name: cleanText(meta.last_name) || null,
        membership_type: cleanText(meta.membership_type) || null,
        university_email: cleanText(meta.university_email) || null,
        field_of_study: cleanText(meta.field_of_study) || null,
        study_year: cleanText(meta.study_year) || null,
        signed_on: cleanText(meta.signed_on) || null,
        applicant_signature: applicantSignatureUrl,
        chairwoman_signature: chairAuthUrl,
        docx_available: !!docxFile,
        pdf_available: !!pdfFile,
      },
    });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
