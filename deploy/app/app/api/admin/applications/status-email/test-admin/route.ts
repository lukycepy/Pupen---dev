import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings, getApplicationStatusNotificationEmailsFromSettings, getApplicationNewNotificationEmailsFromSettings, getApplicationNotificationEmailsFromSettings } from '@/lib/email/mailer';
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
    if (process.env.ENABLE_EMAIL_TESTS !== 'true') {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) throw new Error('Forbidden');

    const body = await req.json().catch(() => ({}));
    const lang = body?.lang === 'en' ? 'en' : 'cs';
    const status = String(body?.status || 'approved');
    const reason = String(body?.reason || (status === 'rejected' ? 'Ukázkový důvod zamítnutí.' : '')).trim();

    const supabase = getServerSupabase();
    const recipients = await resolveStatusAdminRecipients(supabase);
    if (!recipients.length) return NextResponse.json({ error: 'Nejsou nastavení příjemci notifikací.' }, { status: 400 });

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
    const adminLink = `${baseUrl}/${lang}/admin/dashboard?tab=applications`;

    const { subject, html } = await renderEmailTemplateWithDbOverride('application_status_admin', {
      toEmail: 'uchazec@example.com',
      firstName: 'Jan',
      lastName: 'Novák',
      status,
      reason: status === 'rejected' ? reason : '',
      adminLink,
      lang,
    });

    const r = await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'application_status_admin_test', status },
      message: {
        from,
        to: recipients.join(','),
        subject,
        html,
        text: stripHtmlToText(html),
        replyTo: 'info@pupen.org',
        headers: { 'X-Pupen-Category': 'application', 'X-Pupen-Template': 'application_status_admin_test' },
      },
    });
    if (!r.ok && !r.queued) throw r.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'APPLICATION_STATUS_EMAIL_TEST_SENT',
          target_id: null,
          details: { recipients, status, queued: !r.ok && !!r.queued },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, recipients, queued: !r.ok && !!r.queued });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
