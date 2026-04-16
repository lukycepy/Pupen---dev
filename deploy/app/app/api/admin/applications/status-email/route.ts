import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  getMailerWithSettingsOrQueueTransporter,
  getSenderFromSettings,
  getApplicationStatusNotificationEmailsFromSettings,
  getApplicationNewNotificationEmailsFromSettings,
  getApplicationNotificationEmailsFromSettings,
} from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';

export const runtime = 'nodejs';

async function resolveStatusAdminRecipients(supabase: any) {
  const configured = await getApplicationStatusNotificationEmailsFromSettings().catch(() => []);
  const cleaned = Array.isArray(configured) ? configured.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  if (cleaned.length) return cleaned;

  const configuredNew = await getApplicationNewNotificationEmailsFromSettings().catch(() => []);
  const cleanedNew = Array.isArray(configuredNew) ? configuredNew.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  if (cleanedNew.length) return cleanedNew;

  const configuredLegacy = await getApplicationNotificationEmailsFromSettings().catch(() => []);
  const cleanedLegacy = Array.isArray(configuredLegacy) ? configuredLegacy.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  if (cleanedLegacy.length) return cleanedLegacy;

  const { data } = await supabase.from('profiles').select('email').or('is_admin.eq.true,can_manage_admins.eq.true').limit(200);
  return (Array.isArray(data) ? data : [])
    .map((r: any) => String(r?.email || '').trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) throw new Error('Forbidden');

    const body = await req.json().catch(() => ({}));
    const applicationId = String(body?.applicationId || body?.id || '').trim();
    const lang = body?.lang === 'en' ? 'en' : 'cs';
    if (!applicationId) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const supabase = getServerSupabase();
    const appRes = await supabase.from('applications').select('*').eq('id', applicationId).maybeSingle();
    if (appRes.error) throw appRes.error;
    const app: any = appRes.data;
    if (!app?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const email = String(app?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const firstName = String(app?.first_name || String(app?.full_name || app?.name || '').split(' ')[0] || '').trim();
    const lastName = String(app?.last_name || String(app?.full_name || app?.name || '').split(' ').slice(1).join(' ') || '').trim();
    const status = String(app?.status || 'pending');
    const reason = String(app?.rejection_reason || app?.decision_reason || '').trim();

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
    const adminLink = `${baseUrl}/${lang}/admin/dashboard?tab=applications`;

    const { subject, html } = await renderEmailTemplateWithDbOverride('application_status', {
      toEmail: email,
      firstName,
      status,
      reason: status === 'rejected' ? reason : '',
      lang,
    });

    const r = await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'application_status', status },
      message: {
        from,
        to: email,
        subject,
        html,
        text: stripHtmlToText(html),
        replyTo: 'info@pupen.org',
        headers: { 'X-Pupen-Category': 'application', 'X-Pupen-Template': 'application_status' },
      },
    });
    if (!r.ok && !r.queued) throw r.error;

    const adminRecipients = await resolveStatusAdminRecipients(supabase);
    if (adminRecipients.length) {
      const { subject: subjAdmin, html: htmlAdmin } = await renderEmailTemplateWithDbOverride('application_status_admin', {
        toEmail: email,
        firstName,
        lastName,
        status,
        reason: status === 'rejected' ? reason : '',
        adminLink,
        lang,
      });

      const r2 = await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'application_status_admin', status },
        message: {
          from,
          to: adminRecipients.join(','),
          subject: subjAdmin,
          html: htmlAdmin,
          text: stripHtmlToText(htmlAdmin),
          replyTo: 'info@pupen.org',
          headers: { 'X-Pupen-Category': 'application', 'X-Pupen-Template': 'application_status_admin' },
        },
      });
      if (!r2.ok && !r2.queued) throw r2.error;
    }

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'APPLICATION_STATUS_EMAIL_SENT',
          target_id: String(applicationId),
          details: { email, status, queued: !r.ok && !!r.queued, admin_notified: true },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
