import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { ensureMembershipApplicationAccessProvisioned } from '@/lib/membership-applications/access';

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationRow {
  id?: string | null;
  email?: string | null;
  status?: string | null;
  user_id?: string | null;
  meta?: JsonRecord | null;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const appRes = await supabase
      .from('membership_applications_v2')
      .select('id,email,status,user_id,meta')
      .eq('id', id)
      .maybeSingle<MembershipApplicationRow>();
    if (appRes.error) throw appRes.error;
    const app = appRes.data || null;
    if (!app?.id) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    if (String(app.status || '') !== 'approved') {
      return NextResponse.json({ error: 'Only approved applications can receive access links' }, { status: 400 });
    }

    const applicantEmail = String(app.email || '').trim();
    if (!applicantEmail) return NextResponse.json({ error: 'Missing applicant email' }, { status: 400 });

    const meta = toRecord(app.meta);
    const lang = meta.lang === 'en' ? 'en' : 'cs';
    const firstName = String(meta.first_name || '').trim();
    const lastName = String(meta.last_name || '').trim();
    const marketingConsent = meta.newsletter_opt_in === true;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
    const decidedAt = new Date().toISOString();

    const provisioned = await ensureMembershipApplicationAccessProvisioned({
      supabase,
      applicationId: id,
      applicantEmail,
      lang,
      firstName,
      lastName,
      decidedAt,
      actorEmail: user.email || null,
      marketingConsent,
      existingUserId: String(app.user_id || '').trim() || null,
      siteUrl,
    });

    try {
      const transporter = await getMailerWithSettingsOrQueueTransporter();
      const from = await getSenderFromSettings();
      const tpl = await renderEmailTemplateWithDbOverride('application_approved_access', {
        toEmail: applicantEmail,
        firstName,
        lastName,
        actionUrl: provisioned.actionUrlPublic,
        pdfUrl: '',
        lang,
      });
      await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'membership_application_approved_access_resend', application_id: id, user_id: provisioned.userId },
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

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: user.user_metadata?.full_name || user.email || 'admin',
        action: 'MEMBERSHIP_APPLICATION_APPROVED_ACCESS_SENT',
        target_id: id,
        details: {
          email: applicantEmail,
          user_id: provisioned.userId,
          role_id: provisioned.roleId,
          role_name: provisioned.roleName,
          member_no: provisioned.memberNo,
          action_url: true,
          resent: true,
        },
      },
    ]);

    return NextResponse.json({
      ok: true,
      userId: provisioned.userId,
      roleId: provisioned.roleId,
      roleName: provisioned.roleName,
      memberNo: provisioned.memberNo,
      accessEmailQueued: true,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
