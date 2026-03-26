import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function randomToken() {
  return createHash('sha256').update(String(crypto.randomUUID()) + String(Date.now())).digest('hex');
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `forgot:${ip}`, windowMs: 10 * 60 * 1000, max: 5 });
    if (!rl.ok) {
      return NextResponse.json({ ok: true }, { status: 200, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const lang = body?.lang === 'en' ? 'en' : 'cs';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getServerSupabase();

    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/${lang}/reset-password`;
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
    const transporter = await getMailerWithSettings();
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
