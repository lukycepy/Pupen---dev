import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { getServerSupabase } from '@/lib/supabase-server';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';
import { writeAuditLog } from '@/lib/audit/audit-log';
import {
  buildMembershipApplicationPdfBytes,
  buildMembershipApplicationPdfStoragePath,
  formatMembershipApplicationPdfFileName,
  MEMBERSHIP_APPLICATION_PDF_BUCKET,
} from '@/lib/membership-applications/pdf';
import { readFile } from 'node:fs/promises';

export const runtime = 'nodejs';

const TEMPLATE_PDF_URL = new URL('../../../../../../../assets/pdf-templates/prihlaska.pdf', import.meta.url);

type JsonRecord = Record<string, unknown>;

interface ProfilePermissionsRow {
  can_edit_apps?: boolean | null;
  can_manage_admins?: boolean | null;
}

interface MembershipApplicationRow {
  id?: string | null;
  status?: string | null;
  created_at?: string | null;
  meta?: JsonRecord | null;
}

interface ExistingMembershipFileRow {
  id?: string | number | null;
}

interface StoredMembershipFileRow {
  storage_bucket?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
}

interface InsertedMembershipFileRow {
  id?: string | number | null;
}

async function loadTemplatePdfBytes() {
  const buf = await readFile(TEMPLATE_PDF_URL);
  if (buf?.length) return new Uint8Array(buf);
  throw new Error('Missing template PDF');
}

async function downloadStorageFile(bucket: string, storagePath: string) {
  const srv = getServerSupabase();
  const res = await srv.storage.from(bucket).download(storagePath);
  if (res.error) throw res.error;
  const ab = await res.data.arrayBuffer();
  return new Uint8Array(ab);
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) {
      const supabase = getServerSupabase();
      const perm = await supabase
        .from('profiles')
        .select('can_edit_apps, can_manage_admins')
        .eq('id', user.id)
        .maybeSingle<ProfilePermissionsRow>();
      if (perm.error) throw perm.error;
      const canEdit = !!perm.data?.can_edit_apps || !!perm.data?.can_manage_admins;
      if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const templatePdfBytes = await loadTemplatePdfBytes();

    const srv = getServerSupabase();
    const appRes = await srv.from('membership_applications_v2').select('*').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String(appRes.data.status || '') === 'pending') {
      return NextResponse.json({ error: 'Not decided' }, { status: 409 });
    }

    const existing = await rls
      .from('membership_application_files')
      .select('id')
      .eq('application_id', id)
      .contains('meta', { kind: 'application_pdf' })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<ExistingMembershipFileRow>();
    if (existing.error) throw existing.error;
    if (existing.data?.id) {
      await writeAuditLog({
        req,
        actorUserId: user.id,
        actorEmail: user.email || null,
        action: 'membership_application.pdf',
        entity: { type: 'membership_application', id },
        before: { existing_file_id: existing.data.id },
        after: { existing_file_id: existing.data.id },
        details: { already_exists: true },
      });
      return NextResponse.json({ ok: true, fileId: existing.data.id, alreadyExists: true });
    }

    const signatureFile = await srv
      .from('membership_application_files')
      .select('storage_bucket, storage_path, mime_type')
      .eq('application_id', id)
      .contains('meta', { kind: 'applicant_signature' })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<StoredMembershipFileRow>();
    if (signatureFile.error) throw signatureFile.error;
    if (!signatureFile.data) return NextResponse.json({ error: 'Missing applicant signature' }, { status: 409 });

    const meta = toRecord(appRes.data.meta);
    const decision = toRecord(meta.decision);
    const chairAuthFileId = String(decision.chair_auth_file_id || '').trim();
    if (!chairAuthFileId) return NextResponse.json({ error: 'Missing chair auth' }, { status: 409 });

    const chairFile = await srv
      .from('membership_application_files')
      .select('storage_bucket, storage_path, mime_type')
      .eq('id', chairAuthFileId)
      .eq('application_id', id)
      .maybeSingle<StoredMembershipFileRow>();
    if (chairFile.error) throw chairFile.error;
    if (!chairFile.data) return NextResponse.json({ error: 'Invalid chair auth file' }, { status: 409 });

    const applicantSigBytes = await downloadStorageFile(
      String(signatureFile.data.storage_bucket || MEMBERSHIP_APPLICATION_PDF_BUCKET),
      String(signatureFile.data.storage_path || ''),
    );
    const chairAuthBytes = await downloadStorageFile(
      String(chairFile.data.storage_bucket || MEMBERSHIP_APPLICATION_PDF_BUCKET),
      String(chairFile.data.storage_path || ''),
    );

    const pdfBytes = await buildMembershipApplicationPdfBytes({
      templatePdfBytes,
      application: appRes.data,
      applicantSignature: {
        bytes: applicantSigBytes,
        mimeType: String(signatureFile.data.mime_type || 'image/png'),
      },
      chairAuth: {
        bytes: chairAuthBytes,
        mimeType: String(chairFile.data.mime_type || 'image/png'),
      },
    });

    const storagePath = buildMembershipApplicationPdfStoragePath(id);
    const upload = await srv.storage.from(MEMBERSHIP_APPLICATION_PDF_BUCKET).upload(storagePath, pdfBytes, {
      upsert: false,
      contentType: 'application/pdf',
    });
    if (upload.error) throw upload.error;

    const { utf8: fileName } = formatMembershipApplicationPdfFileName({
      firstName: meta.first_name,
      lastName: meta.last_name,
      createdAt: appRes.data.created_at,
    });

    const ins = await withSchemaCacheRetry(srv, async () => {
      return await srv
        .from('membership_application_files')
        .insert([
          {
            application_id: id,
            storage_bucket: MEMBERSHIP_APPLICATION_PDF_BUCKET,
            storage_path: storagePath,
            file_name: fileName,
            mime_type: 'application/pdf',
            size_bytes: pdfBytes.length,
            meta: {
              kind: 'application_pdf',
              generated_at: new Date().toISOString(),
              generated_by_email: user.email || null,
              template: 'prihlaska.pdf',
            },
          },
        ])
        .select('id')
        .single<InsertedMembershipFileRow>();
    });
    if (ins.error) throw ins.error;

    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'membership_application.pdf',
      entity: { type: 'membership_application', id },
      before: { existing_file_id: null },
      after: { file_id: ins.data?.id || null, bucket: MEMBERSHIP_APPLICATION_PDF_BUCKET, path: storagePath, size_bytes: pdfBytes.length },
    });

    return NextResponse.json({ ok: true, fileId: ins.data?.id || null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status =
      message === 'Unauthorized'
        ? 401
        : message === 'Forbidden'
          ? 403
          : message === 'Not decided'
            ? 409
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
