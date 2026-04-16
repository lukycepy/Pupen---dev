import { NextResponse } from 'next/server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export async function POST(req: Request) {
  const g = await guardPublicJsonPost(req, {
    keyPrefix: 'login',
    windowMs: 60_000,
    max: 10,
    honeypot: false,
    tooManyMessage: 'Too many login attempts',
    tooManyPayload: { retryAfterMs: 0 },
  });
  if (!g.ok) return g.response;
  const ip = g.ip;
  const body = g.body;
  const secret = process.env.TURNSTILE_SECRET_KEY || '';
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const turnstileEnabled = !!(secret && siteKey);
  if (turnstileEnabled) {
    const token = String(body?.token || body?.captchaToken || '').trim();
    if (!token) return NextResponse.json({ error: 'Captcha required' }, { status: 400 });
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (ip && ip !== 'unknown') form.set('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }).catch(() => null);
    if (!res) return NextResponse.json({ error: 'Captcha verify failed' }, { status: 400 });
    const json: any = await res.json().catch(() => ({}));
    if (!json?.success) return NextResponse.json({ error: 'Invalid captcha' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
