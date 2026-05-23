import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { isSameSiteRequest } from '@/lib/request-origin';
import { isRequestBanned } from '@/lib/security/bans';

export async function POST(req: Request) {
  const ip = getClientIp(req) || 'unknown';
  if (await isRequestBanned({ ip })) {
    return NextResponse.json({ error: 'Banned' }, { status: 403 });
  }

  if (!isSameSiteRequest(req)) {
    return NextResponse.json({ error: 'Zakázaný požadavek.' }, { status: 403 });
  }

  const ua = String(req.headers.get('user-agent') || '').slice(0, 120) || 'unknown';
  const rl = await rateLimit({ bucket: 'login', key: `${ip}:${ua}`, windowMs: 60_000, max: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts', retryAfterMs: rl.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch(() => ({}));
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
