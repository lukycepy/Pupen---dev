import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const subject = String(body?.subject || '').trim().slice(0, 240);
    const html = String(body?.html || '').trim();
    const testEmail = String(body?.email || user.email || '').trim();

    if (!subject || !html || !testEmail) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();
    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
    const unsubUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(testEmail)}`;
    const emailVars = { subject, html, unsubLink: unsubUrl };
    
    const { html: wrappedHtml, subject: wrappedSubject } = await renderEmailTemplateWithDbOverride('newsletter', emailVars);

    const r = await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'newsletter_preview' },
      message: { 
        from, 
        to: testEmail, 
        subject: `[PREVIEW] ${wrappedSubject}`, 
        html: wrappedHtml,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
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
