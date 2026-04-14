import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings, getApplicationNewNotificationEmailsFromSettings, getApplicationNotificationEmailsFromSettings } from '@/lib/email/mailer';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export const runtime = 'nodejs';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

async function resolveAdminRecipients(supabase: any) {
  const configuredNew = await getApplicationNewNotificationEmailsFromSettings().catch(() => []);
  const cleanedNew = Array.isArray(configuredNew) ? configuredNew.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  if (cleanedNew.length) return cleanedNew;

  const configuredLegacy = await getApplicationNotificationEmailsFromSettings().catch(() => []);
  const cleaned = Array.isArray(configuredLegacy) ? configuredLegacy.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  if (cleaned.length) return cleaned;

  const { data } = await supabase.from('profiles').select('email').or('is_admin.eq.true,can_manage_admins.eq.true').limit(200);
  return (Array.isArray(data) ? data : [])
    .map((r: any) => String(r?.email || '').trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'app_notify',
      windowMs: 10 * 60_000,
      max: 40,
      honeypot: false,
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const applicationId = String(body?.applicationId || '').trim();
    const lang = body?.lang === 'en' ? 'en' : 'cs';

    if (!isUuid(applicationId)) return NextResponse.json({ error: 'Invalid applicationId.' }, { status: 400 });

    const supabase = getServerSupabase();
    const { data: app, error } = await supabase.from('applications').select('*').eq('id', applicationId).maybeSingle();
    if (error) throw error;
    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';

    const firstName = String(app?.first_name || '').trim();
    const lastName = String(app?.last_name || '').trim();
    const toEmail = String(app?.email || '').trim().toLowerCase();

    const adminRecipients = await resolveAdminRecipients(supabase);
    const adminLink = `${baseUrl}/${lang}/admin/dashboard?tab=applications`;

    const { subject: subjApplicant, html: htmlApplicant } = await renderEmailTemplateWithDbOverride('application_received', {
      lang,
      firstName,
      lastName,
      toEmail,
      adminLink,
    });
    const textApplicant = stripHtmlToText(htmlApplicant);

    await sendMailWithQueueFallback({
      transporter,
      message: {
        from,
        to: toEmail,
        subject: subjApplicant,
        html: htmlApplicant,
        text: textApplicant,
        replyTo: 'info@pupen.org',
        headers: { 'X-Pupen-Category': 'application', 'X-Pupen-Template': 'application_received' },
      },
      meta: { kind: 'application_received', lang, application_id: applicationId },
      supabase,
    });

    if (adminRecipients.length) {
      const { subject: subjAdmin, html: htmlAdmin } = await renderEmailTemplateWithDbOverride('application_new_admin', {
        lang,
        firstName,
        lastName,
        toEmail,
        membershipType: String(app?.membership_type || ''),
        adminLink,
      });
      const textAdmin = stripHtmlToText(htmlAdmin);

      await sendMailWithQueueFallback({
        transporter,
        message: {
          from,
          to: adminRecipients.join(','),
          subject: subjAdmin,
          html: htmlAdmin,
          text: textAdmin,
          replyTo: 'info@pupen.org',
          headers: { 'X-Pupen-Category': 'application', 'X-Pupen-Template': 'application_new_admin' },
        },
        meta: { kind: 'application_new_admin', lang, application_id: applicationId },
        supabase,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Error') }, { status: 500 });
  }
}
