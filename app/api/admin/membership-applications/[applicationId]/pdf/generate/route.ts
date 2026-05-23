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

export const runtime = 'nodejs';

async function loadTemplatePdfBytes() {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const candidates = ['PUPEN-prihlaska.pdf', 'prihlaska.pdf'];
  for (const name of candidates) {
    try {
      const p = path.join(process.cwd(), name);
      const buf = await fs.readFile(p);
      if (buf?.length) return new Uint8Array(buf);
    } catch {}
  }
  throw new Error('Missing template PDF');
}

async function downloadStorageFile(bucket: string, storagePath: string) {
  const srv = getServerSupabase();
  const res = await srv.storage.from(bucket).download(storagePath);
  if (res.error) throw res.error;
  const ab = await res.data.arrayBuffer();
  return new Uint8Array(ab);
}

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) {
      const supabase = getServerSupabase();
      const perm = await supabase.from('profiles').select('can_edit_apps, can_manage_admins').eq('id', user.id).maybeSingle();
      if (perm.error) throw perm.error;
      const canEdit = !!(perm.data as any)?.can_edit_apps || !!(perm.data as any)?.can_manage_admins;
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
    const appRes = await srv.from('membership_applications_v2').select('*').eq('id', id).maybeSingle();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String((appRes.data as any).status || '') === 'pending') {
      return NextResponse.json({ error: 'Not decided' }, { status: 409 });
    }

    const existing = await rls
      .from('membership_application_files')
      .select('id')
      .eq('application_id', id)
      .contains('meta', { kind: 'application_pdf' })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
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
      .maybeSingle();
    if (signatureFile.error) throw signatureFile.error;
    if (!signatureFile.data) return NextResponse.json({ error: 'Missing applicant signature' }, { status: 409 });

    const meta = (appRes.data as any)?.meta && typeof (appRes.data as any)?.meta === 'object' ? (appRes.data as any).meta : {};
    const decision = meta?.decision && typeof meta.decision === 'object' ? meta.decision : {};
    const chairAuthFileId = String(decision?.chair_auth_file_id || '').trim();
    if (!chairAuthFileId) return NextResponse.json({ error: 'Missing chair auth' }, { status: 409 });

    const chairFile = await srv
      .from('membership_application_files')
      .select('storage_bucket, storage_path, mime_type')
      .eq('id', chairAuthFileId)
      .eq('application_id', id)
      .maybeSingle();
    if (chairFile.error) throw chairFile.error;
    if (!chairFile.data) return NextResponse.json({ error: 'Invalid chair auth file' }, { status: 409 });

    const applicantSigBytes = await downloadStorageFile(
      String((signatureFile.data as any).storage_bucket || MEMBERSHIP_APPLICATION_PDF_BUCKET),
      String((signatureFile.data as any).storage_path || ''),
    );
    const chairAuthBytes = await downloadStorageFile(
      String((chairFile.data as any).storage_bucket || MEMBERSHIP_APPLICATION_PDF_BUCKET),
      String((chairFile.data as any).storage_path || ''),
    );

    const pdfBytes = await buildMembershipApplicationPdfBytes({
      templatePdfBytes,
      application: appRes.data,
      applicantSignature: {
        bytes: applicantSigBytes,
        mimeType: String((signatureFile.data as any).mime_type || 'image/png'),
      },
      chairAuth: {
        bytes: chairAuthBytes,
        mimeType: String((chairFile.data as any).mime_type || 'image/png'),
      },
    });

    const storagePath = buildMembershipApplicationPdfStoragePath(id);
    const upload = await srv.storage.from(MEMBERSHIP_APPLICATION_PDF_BUCKET).upload(storagePath, pdfBytes, {
      upsert: false,
      contentType: 'application/pdf',
    });
    if (upload.error) throw upload.error;

    const { utf8: fileName } = formatMembershipApplicationPdfFileName({
      firstName: meta?.first_name,
      lastName: meta?.last_name,
      createdAt: (appRes.data as any)?.created_at,
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
        .single();
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
  } catch (e: any) {
    const status =
      e?.message === 'Unauthorized'
        ? 401
        : e?.message === 'Forbidden'
          ? 403
          : e?.message === 'Not decided'
            ? 409
            : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
