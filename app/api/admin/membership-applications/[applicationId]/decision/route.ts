import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { membershipApplicationAdminDecisionSchema } from '@/lib/validations/membership-applications-admin';
import { getServerSupabase } from '@/lib/supabase-server';
import { enqueueEmailTrigger } from '@/lib/email/triggers';
import { writeAuditLog } from '@/lib/audit/audit-log';
import {
  getApplicationNewNotificationEmailsFromSettings,
  getApplicationNotificationEmailsFromSettings,
  getApplicationStatusNotificationEmailsFromSettings,
} from '@/lib/email/mailer';

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationDecisionRow {
  id?: string | null;
  email?: string | null;
  status?: string | null;
  decision_reason?: string | null;
  meta?: JsonRecord | null;
}

interface MembershipApplicationFileIdRow {
  id?: string | number | null;
}

interface ProfileEmailRow {
  email?: string | null;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function mergeDecision(meta: unknown, patch: JsonRecord) {
  const base = toRecord(meta);
  const prevDecision = toRecord(base.decision);
  return { ...base, decision: { ...prevDecision, ...patch } };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const body = toRecord(await req.json().catch(() => ({})));
    const lang = body.lang === 'en' ? 'en' : 'cs';
    const parsed = membershipApplicationAdminDecisionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const appRes = await rls
      .from('membership_applications_v2')
      .select('status,meta')
      .eq('id', id)
      .maybeSingle<MembershipApplicationDecisionRow>();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String(appRes.data.status || '') !== 'pending') return NextResponse.json({ error: 'Immutable' }, { status: 409 });

    const expectedKind = `chair_${parsed.data.decision.chairAuthKind}`;
    const fileRes = await rls
      .from('membership_application_files')
      .select('id')
      .eq('id', parsed.data.decision.chairAuthFileId)
      .eq('application_id', id)
      .contains('meta', { kind: expectedKind })
      .maybeSingle<MembershipApplicationFileIdRow>();
    if (fileRes.error) throw fileRes.error;
    if (!fileRes.data) return NextResponse.json({ error: 'Invalid chair auth file' }, { status: 400 });

    const decidedAt = new Date().toISOString();
    const decidedBy = user.email || null;

    const nextMeta = mergeDecision(appRes.data.meta, {
      decided_at: decidedAt,
      decided_by_email: decidedBy,
      membership_type: parsed.data.decision.membershipType,
      chair_auth_kind: parsed.data.decision.chairAuthKind,
      chair_auth_file_id: parsed.data.decision.chairAuthFileId,
      status: parsed.data.decision.status,
    });

    const up = await rls
      .from('membership_applications_v2')
      .update({
        status: parsed.data.decision.status,
        decision_reason: parsed.data.decision.reason || null,
        meta: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (up.error) throw up.error;

    const srv = getServerSupabase();
    const fullRes = await srv
      .from('membership_applications_v2')
      .select('id, email, status, decision_reason, meta')
      .eq('id', id)
      .maybeSingle<MembershipApplicationDecisionRow>();
    if (fullRes.error) throw fullRes.error;
    const app = fullRes.data;
    const applicantEmail = String(app?.email || '').trim().toLowerCase();
    const meta = toRecord(app?.meta);
    const firstName = String(meta.first_name || '').trim();
    const lastName = String(meta.last_name || '').trim();
    const status = String(parsed.data.decision.status || '');
    const reason = String(parsed.data.decision.reason || '').trim();

    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'membership_application.decision',
      entity: { type: 'membership_application', id },
      before: appRes.data,
      after: fullRes.data,
      details: { status, reason: reason || null, chair_auth_file_id: parsed.data.decision.chairAuthFileId },
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
    const adminLink = `${baseUrl}/${lang}/admin/dashboard#applications`;

    if (applicantEmail && applicantEmail.includes('@')) {
      await enqueueEmailTrigger({
        triggerKey: 'membership_application_status',
        toEmail: applicantEmail,
        lang,
        vars: {
          toEmail: applicantEmail,
          firstName,
          status,
          reason: status === 'rejected' ? reason : '',
        },
        headers: { 'X-Pupen-Category': 'membership', 'X-Pupen-Trigger': 'membership_application_status' },
        meta: { application_id: id },
        supabase: srv,
      });
    }

    let adminRecipients: string[] = [];
    const configuredStatus = await getApplicationStatusNotificationEmailsFromSettings().catch(() => []);
    const cleanedStatus = Array.isArray(configuredStatus) ? configuredStatus.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
    if (cleanedStatus.length) adminRecipients = cleanedStatus;
    if (!adminRecipients.length) {
      const configuredNew = await getApplicationNewNotificationEmailsFromSettings().catch(() => []);
      const cleanedNew = Array.isArray(configuredNew) ? configuredNew.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
      if (cleanedNew.length) adminRecipients = cleanedNew;
    }
    if (!adminRecipients.length) {
      const configuredLegacy = await getApplicationNotificationEmailsFromSettings().catch(() => []);
      const cleanedLegacy = Array.isArray(configuredLegacy) ? configuredLegacy.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
      if (cleanedLegacy.length) adminRecipients = cleanedLegacy;
    }
    if (!adminRecipients.length) {
      const { data: profs } = await srv.from('profiles').select('email').or('is_admin.eq.true,can_manage_admins.eq.true').limit(200);
      adminRecipients = (Array.isArray(profs) ? (profs as ProfileEmailRow[]) : [])
        .map((row) => String(row.email || '').trim().toLowerCase())
        .filter(Boolean);
    }

    if (adminRecipients.length) {
      await enqueueEmailTrigger({
        triggerKey: 'membership_application_status_admin',
        toEmail: adminRecipients.join(','),
        lang,
        vars: {
          toEmail: applicantEmail,
          firstName,
          lastName,
          status,
          reason: status === 'rejected' ? reason : '',
          adminLink,
        },
        headers: { 'X-Pupen-Category': 'membership', 'X-Pupen-Trigger': 'membership_application_status_admin' },
        meta: { application_id: id, applicant_email: applicantEmail },
        supabase: srv,
      });
    }

    return NextResponse.json({ ok: true, decidedAt, decidedBy });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
