import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { guardPublicJsonPostSilentOk } from '@/lib/public-post-guard';
import { getPublicBaseUrl } from '@/lib/public-base-url';

function getResetBaseUrl(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.origin;
    }
  } catch {}
  return getPublicBaseUrl();
}

function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

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
    const redirectTo = `${getResetBaseUrl(req)}/${lang}/reset-password`;
    try {
      const transporter = await getMailerWithSettings();
      const gen = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      if (gen.error) throw gen.error;

      const resetUrl = String((gen.data as any)?.properties?.action_link || '');
      if (!resetUrl) throw new Error('Missing reset URL');

      const { subject, html } = await renderEmailTemplateWithDbOverride('password_reset', { email, resetUrl, lang });
      const from = await getSenderFromSettings();
      await transporter.sendMail({ from, to: email, subject, html });
    } catch {
      const publicSupabase = getPublicSupabase();
      const recovery = await publicSupabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (recovery.error) throw recovery.error;
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
