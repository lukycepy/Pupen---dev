import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { membershipApplicationAdminDecisionSchema } from '@/lib/validations/membership-applications-admin';
import { getServerSupabase } from '@/lib/supabase-server';
import { enqueueEmailTrigger } from '@/lib/email/triggers';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { writeAuditLog } from '@/lib/audit/audit-log';
import {
  getApplicationNewNotificationEmailsFromSettings,
  getApplicationNotificationEmailsFromSettings,
  getApplicationStatusNotificationEmailsFromSettings,
} from '@/lib/email/mailer';
import { subscribeToNewsletter } from '@/lib/newsletter/subscribe';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { ensureMembershipApplicationAccessProvisioned } from '@/lib/membership-applications/access';

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationDecisionRow {
  id?: string | null;
  email?: string | null;
  user_id?: string | null;
  status?: string | null;
  decision_reason?: string | null;
  meta?: JsonRecord | null;
}

interface MembershipApplicationFileIdRow {
  id?: string | number | null;
}

interface ProfileEmailRow {
  id?: string | null;
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

function isMissingColumnError(message: string, feature: string) {
  return new RegExp(feature, 'i').test(message) && /(schema cache|does not exist|column|relation)/i.test(message);
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
      .select('status,meta,user_id,email')
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
    const marketingConsent = meta.newsletter_opt_in === true;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
    let provisionedUserId: string | null = null;
    let provisionedRoleId: string | null = null;
    let provisionedRoleName: string | null = null;
    let provisionedMemberNo: number | null = null;
    let actionUrlPublic = '';

    if (status === 'approved' && applicantEmail) {
      const provisioned = await ensureMembershipApplicationAccessProvisioned({
        supabase: srv,
        applicationId: id,
        applicantEmail,
        lang,
        firstName,
        lastName,
        decidedAt,
        actorEmail: user.email || null,
        marketingConsent,
        existingUserId: String(app?.user_id || appRes.data.user_id || '').trim() || null,
        siteUrl: baseUrl,
      });
      provisionedUserId = provisioned.userId;
      provisionedRoleId = provisioned.roleId;
      provisionedRoleName = provisioned.roleName;
      provisionedMemberNo = provisioned.memberNo;
      actionUrlPublic = provisioned.actionUrlPublic;

      const targetUserIds = new Set<string>();
      const appUserId = String(provisionedUserId || app?.user_id || appRes.data.user_id || '').trim();
      if (appUserId) targetUserIds.add(appUserId);

      if (!targetUserIds.size) {
        const profRes = await srv.from('profiles').select('id').eq('email', applicantEmail).limit(20);
        if (!profRes.error) {
          for (const row of Array.isArray(profRes.data) ? (profRes.data as Array<{ id?: string | null }>) : []) {
            const profileId = String(row.id || '').trim();
            if (profileId) targetUserIds.add(profileId);
          }
        }
      }

      if (targetUserIds.size) {
        const consentPayload = {
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? decidedAt : null,
          updated_at: new Date().toISOString(),
        };
        let profUp = await srv.from('profiles').update(consentPayload).in('id', Array.from(targetUserIds));
        if (profUp.error && isMissingColumnError(profUp.error.message, 'marketing_consent_at')) {
          profUp = await srv.from('profiles').update({ marketing_consent: marketingConsent }).in('id', Array.from(targetUserIds));
        }
        if (profUp.error && !isMissingColumnError(profUp.error.message, 'marketing_consent')) {
          throw profUp.error;
        }
      }

      if (marketingConsent) {
        try {
          await subscribeToNewsletter({
            supabase: srv,
            email: applicantEmail,
            categories: ['all'],
            source: 'membership_approval',
            lang,
            requestUrl: req.url,
          });
        } catch {}
      }

      try {
        const transporter = await getMailerWithSettingsOrQueueTransporter();
        const from = await getSenderFromSettings();
        const tpl = await renderEmailTemplateWithDbOverride('application_approved_access', {
          toEmail: applicantEmail,
          firstName,
          lastName,
          actionUrl: actionUrlPublic,
          pdfUrl: '',
          lang,
        });
        await sendMailWithQueueFallback({
          transporter,
          supabase: srv,
          meta: { kind: 'membership_application_approved_access', application_id: id, user_id: provisionedUserId },
          message: {
            from,
            to: applicantEmail,
            subject: tpl.subject,
            html: tpl.html,
            text: stripHtmlToText(tpl.html),
            replyTo: 'info@pupen.org',
            headers: { 'X-Pupen-Category': 'membership', 'X-Pupen-Template': 'application_approved_access' },
          },
        });
      } catch {}
    }

    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'membership_application.decision',
      entity: { type: 'membership_application', id },
      before: appRes.data,
      after: fullRes.data,
      details: {
        status,
        reason: reason || null,
        chair_auth_file_id: parsed.data.decision.chairAuthFileId,
        user_id: provisionedUserId,
        role_id: provisionedRoleId,
        role_name: provisionedRoleName,
        member_no: provisionedMemberNo,
        access_email: !!actionUrlPublic,
      },
    });

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

    if (status === 'approved' && provisionedUserId) {
      await srv.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'MEMBERSHIP_APPLICATION_APPROVED_ACCESS_SENT',
          target_id: String(id),
          details: {
            email: applicantEmail,
            user_id: provisionedUserId,
            role_id: provisionedRoleId,
            role_name: provisionedRoleName,
            member_no: provisionedMemberNo,
            action_url: !!actionUrlPublic,
          },
        },
      ]);
    }

    return NextResponse.json({
      ok: true,
      decidedAt,
      decidedBy,
      userId: provisionedUserId,
      memberNo: provisionedMemberNo,
      accessEmailQueued: !!actionUrlPublic,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
