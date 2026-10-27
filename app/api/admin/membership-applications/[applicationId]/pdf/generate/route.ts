import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { writeAuditLog } from '@/lib/audit/audit-log';
import {
  ensureMembershipApplicationPdf,
} from '@/lib/membership-applications/pdf';

export const runtime = 'nodejs';

interface ProfilePermissionsRow {
  can_edit_apps?: boolean | null;
  can_manage_admins?: boolean | null;
}

interface MembershipApplicationRow {
  id?: string | null;
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

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const srv = getServerSupabase();
    const appRes = await srv.from('membership_applications_v2').select('*').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const ensured = await ensureMembershipApplicationPdf({
      applicationId: id,
      generatedByEmail: user.email || null,
    });

    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'membership_application.pdf',
      entity: { type: 'membership_application', id },
      before: { existing_file_id: ensured.alreadyExists ? ensured.fileId : null },
      after: { file_id: ensured.fileId || null },
      details: { already_exists: ensured.alreadyExists },
    });

    return NextResponse.json({ ok: true, fileId: ensured.fileId || null, alreadyExists: ensured.alreadyExists });
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
