import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { guardPublicJsonPostSilentOk } from '@/lib/public-post-guard';
import { getPublicBaseUrl } from '@/lib/public-base-url';

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPostSilentOk(req, {
      keyPrefix: 'forgot',
      windowMs: 10 * 60 * 1000,
      max: 5,
      honeypot: false,
      sameSite: true,
      okPayload: { ok: true },
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const email = String(body?.email || '').trim().toLowerCase();
    const lang = body?.lang === 'en' ? 'en' : 'cs';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getServerSupabase();

    const redirectTo = `${getPublicBaseUrl()}/${lang}/reset-password`;
    const gen = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (gen.error) {
      return NextResponse.json({ ok: true });
    }
    const resetUrl = String((gen.data as any)?.properties?.action_link || '');
    if (!resetUrl) return NextResponse.json({ ok: true });

    const { subject, html } = await renderEmailTemplateWithDbOverride('password_reset', { email, resetUrl, lang });
    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();

    try {
      await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'password_reset' },
        message: { from, to: email, subject, html },
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
