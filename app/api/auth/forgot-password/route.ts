import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function randomToken() {
  return createHash('sha256').update(String(crypto.randomUUID()) + String(Date.now())).digest('hex');
}

async function findUserIdByEmail(supabase: any, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const users = res.data?.users || [];
    const u = users.find((x: any) => String(x?.email || '').toLowerCase() === email.toLowerCase());
    if (u?.id) return String(u.id);
    if (users.length < perPage) return null;
  }
  return null;
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
    const userId = await findUserIdByEmail(supabase, email).catch(() => null);
    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    const token = randomToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabase.from('password_resets').delete().eq('user_id', userId);
    await supabase
      .from('password_resets')
      .insert([{ token_hash: tokenHash, user_id: userId, email, expires_at: expiresAt }])
      .throwOnError();

    const origin = new URL(req.url).origin;
    const resetUrl = `${origin}/${lang}/reset-password?token=${encodeURIComponent(token)}`;

    const { subject, html } = renderEmailTemplate('password_reset', { email, resetUrl, lang });
    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    await transporter.sendMail({ from, to: email, subject, html });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
