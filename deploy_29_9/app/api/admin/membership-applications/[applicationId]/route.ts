import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { membershipApplicationAdminUpdateSchema } from '@/lib/validations/membership-applications-admin';
import { writeAuditLog } from '@/lib/audit/audit-log';
import { getServerSupabase } from '@/lib/supabase-server';

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationRow {
  id?: string | null;
  status?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  motivation?: string | null;
  faculty?: string | null;
  meta?: JsonRecord | null;
}

interface MembershipApplicationFileRow {
  id?: string | number | null;
  created_at?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  meta?: JsonRecord | null;
}

interface AdminLogRow {
  action?: string | null;
  admin_email?: string | null;
  admin_name?: string | null;
  created_at?: string | null;
  details?: JsonRecord | null;
}

interface ProfileDuplicateRow {
  id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_member?: boolean | null;
  is_admin?: boolean | null;
  created_at?: string | null;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function mergeMeta(prev: unknown, patch: unknown) {
  const base = toRecord(prev);
  const p = toRecord(patch);
  const next: JsonRecord = { ...base };
  for (const [k, v] of Object.entries(p)) {
    if (k === 'pdf_snapshot' && v && typeof v === 'object') {
      const prevSnap = toRecord(next.pdf_snapshot);
      next.pdf_snapshot = { ...prevSnap, ...toRecord(v) };
      continue;
    }
    next[k] = v;
  }
  return next;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export async function GET(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);
    const srv = getServerSupabase();

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const appRes = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const filesRes = await rls
      .from('membership_application_files')
      .select('id,created_at,file_name,mime_type,size_bytes,meta')
      .eq('application_id', id)
      .order('created_at', { ascending: false });
    if (filesRes.error) throw filesRes.error;

    const files: MembershipApplicationFileRow[] = Array.isArray(filesRes.data) ? filesRes.data : [];

    const logsRes = await srv
      .from('admin_logs')
      .select('action,admin_email,admin_name,created_at,details')
      .eq('target_id', id)
      .in('action', ['membership_application.decision', 'MEMBERSHIP_APPLICATION_APPROVED_ACCESS_SENT', 'MEMBERSHIP_APPLICATION_DEDUPE_REVIEWED'])
      .order('created_at', { ascending: false })
      .limit(20);
    const logs: AdminLogRow[] = logsRes.error || !Array.isArray(logsRes.data) ? [] : logsRes.data;
    const latestDecisionLog = logs.find((row) => String(row.action || '') === 'membership_application.decision') || null;
    const latestAccessLog = logs.find((row) => String(row.action || '') === 'MEMBERSHIP_APPLICATION_APPROVED_ACCESS_SENT') || null;
    const latestDedupeLog = logs.find((row) => String(row.action || '') === 'MEMBERSHIP_APPLICATION_DEDUPE_REVIEWED') || null;
    const decisionDetails = latestDecisionLog?.details || {};
    const accessDetails = latestAccessLog?.details || {};
    const provisioning = {
      userId: String(accessDetails.user_id || decisionDetails.user_id || '').trim() || null,
      roleId: String(accessDetails.role_id || decisionDetails.role_id || '').trim() || null,
      roleName: String(accessDetails.role_name || decisionDetails.role_name || '').trim() || null,
      memberNo:
        typeof accessDetails.member_no === 'number'
          ? accessDetails.member_no
          : typeof decisionDetails.member_no === 'number'
            ? decisionDetails.member_no
            : null,
      accessEmailQueued: Boolean(accessDetails.action_url || decisionDetails.access_email),
      accessEmailSentAt: latestAccessLog?.created_at || null,
      accessEmailSentBy: latestAccessLog?.admin_email || null,
      accessEmailResent: accessDetails.resent === true,
    };
    const email = normalizeEmail(appRes.data.email);
    const dedupe = {
      duplicateApplicationCount: 0,
      duplicateProfileCount: 0,
      sameEmailApplications: [] as Array<{ id: string | null; status: string | null; createdAt: string | null; name: string | null }>,
      sameEmailProfiles: [] as Array<{
        id: string | null;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        isMember: boolean;
        isAdmin: boolean;
        createdAt: string | null;
      }>,
      review: {
        reviewedAt: latestDedupeLog?.created_at || null,
        reviewedBy: latestDedupeLog?.admin_email || latestDedupeLog?.admin_name || null,
        primaryProfileId: String(latestDedupeLog?.details?.primary_profile_id || '').trim() || null,
        note: String(latestDedupeLog?.details?.note || '').trim() || null,
      },
    };

    if (email) {
      const [duplicateAppsRes, duplicateProfilesRes] = await Promise.all([
        rls
          .from('membership_applications_v2')
          .select('id,status,created_at,name,email')
          .eq('email', email)
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(10),
        srv
          .from('profiles')
          .select('id,email,first_name,last_name,is_member,is_admin,created_at')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      if (!duplicateAppsRes.error) {
        const rows = Array.isArray(duplicateAppsRes.data) ? duplicateAppsRes.data as Array<{ id?: string | null; status?: string | null; created_at?: string | null; name?: string | null }> : [];
        dedupe.duplicateApplicationCount = rows.length;
        dedupe.sameEmailApplications = rows.map((row) => ({
          id: row.id || null,
          status: row.status || null,
          createdAt: row.created_at || null,
          name: row.name || null,
        }));
      }
      if (!duplicateProfilesRes.error) {
        const rows = Array.isArray(duplicateProfilesRes.data) ? (duplicateProfilesRes.data as ProfileDuplicateRow[]) : [];
        dedupe.duplicateProfileCount = rows.length;
        dedupe.sameEmailProfiles = rows.map((row) => ({
          id: row.id || null,
          email: row.email || null,
          firstName: row.first_name || null,
          lastName: row.last_name || null,
          isMember: row.is_member === true,
          isAdmin: row.is_admin === true,
          createdAt: row.created_at || null,
        }));
      }
    }

    return NextResponse.json({ ok: true, application: appRes.data, files, provisioning, dedupe });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const parsed = membershipApplicationAdminUpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const current = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String(current.data.status || '') !== 'pending') {
      return NextResponse.json({ error: 'Immutable' }, { status: 409 });
    }

    const prevMeta = current.data.meta;
    const patchMeta = parsed.data.application.meta;
    const nextMeta = mergeMeta(prevMeta, patchMeta);

    const firstName = String(nextMeta.first_name || '').trim();
    const lastName = String(nextMeta.last_name || '').trim();
    const nextName = `${firstName} ${lastName}`.trim() || String(current.data.name || '').trim() || null;
    const membershipType = String(nextMeta.membership_type || '').trim();
    const fieldOfStudy = String(nextMeta.field_of_study || '').trim();
    const nextFaculty = membershipType === 'regular' ? fieldOfStudy || null : null;

    const up = await rls
      .from('membership_applications_v2')
      .update({
        email: parsed.data.application.email,
        phone: parsed.data.application.phone,
        address: parsed.data.application.address,
        motivation: parsed.data.application.motivation,
        name: nextName,
        faculty: nextFaculty,
        meta: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (up.error) throw up.error;

    const afterRes = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (afterRes.error) throw afterRes.error;

    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'membership_application.edit',
      entity: { type: 'membership_application', id },
      before: current.data,
      after: afterRes.data || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
