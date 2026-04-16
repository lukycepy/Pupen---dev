import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { addUtmToEmailHtml } from '@/lib/email/utm';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';
import { stripHtmlToText } from '@/lib/richtext-shared';

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const subject = String(body?.subject || '').trim().slice(0, 240);
    const html = sanitizeEmailHtml(String(body?.html || '').trim());
    const testEmail = String(body?.email || user.email || '').trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!subject || !html || !testEmail) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();
    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
    const preheader = stripHtmlToText(html).slice(0, 140);
    const unsubPageUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(testEmail)}&n=preview`;
    const unsubApiUrl = `${baseUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(testEmail)}&reason=one_click&source=list_unsubscribe&n=preview`;
    const preferencesLink = `${baseUrl}/unsubscribe?email=${encodeURIComponent(testEmail)}`;
    const emailVars = { subject, preheader, html, unsubLink: unsubPageUrl, preferencesLink };
    
    const { html: wrappedHtml, subject: wrappedSubject } = await renderEmailTemplateWithDbOverride('newsletter', emailVars);
    const trackedHtml = addUtmToEmailHtml(wrappedHtml, { baseUrl, campaign: 'preview', source: 'newsletter', medium: 'email', email: testEmail });

    const r = await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'newsletter_preview' },
      message: { 
        from, 
        to: testEmail, 
        subject: `[PREVIEW] ${wrappedSubject}`, 
        html: trackedHtml,
        attachments: attachments
          .map((a: any) => ({ filename: a?.name, path: a?.url }))
          .filter((a: any) => typeof a?.filename === 'string' && a.filename && typeof a?.path === 'string' && a.path),
        headers: {
          'List-Unsubscribe': `<${unsubApiUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      },
    });

    if (!r.ok) {
      if (!r.queued) throw r.error;
    }

    return NextResponse.json({ ok: true, queued: !!r.queued });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
