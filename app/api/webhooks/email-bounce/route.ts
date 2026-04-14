import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

function normEmail(v: any) {
  return String(v || '').trim().toLowerCase().slice(0, 240);
}

function pickEmail(body: any) {
  const direct = normEmail(body?.email || body?.recipient || body?.to || body?.address);
  if (direct.includes('@')) return direct;
  const arr = Array.isArray(body?.recipients) ? body.recipients : Array.isArray(body?.emails) ? body.emails : null;
  if (arr && arr.length) {
    const first = normEmail(arr[0]);
    if (first.includes('@')) return first;
  }
  return '';
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = req.headers.get('x-webhook-secret') || url.searchParams.get('secret') || '';
  const expected = process.env.BOUNCE_WEBHOOK_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();

  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'webhook_bounce',
      windowMs: 60_000,
      max: 120,
      sameSite: false,
      honeypot: false,
      tooManyMessage: 'Too many requests',
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const email = pickEmail(body);
    if (!email || !email.includes('@')) return NextResponse.json({ ok: true, ignored: true });

    const provider = body?.provider ? String(body.provider).slice(0, 80) : '';
    const bounceType = body?.type ? String(body.type).slice(0, 80) : body?.bounceType ? String(body.bounceType).slice(0, 80) : '';
    const reason = body?.reason ? String(body.reason).slice(0, 500) : body?.description ? String(body.description).slice(0, 500) : '';
    const now = new Date().toISOString();

    const cur = await supabase.from('email_bounces').select('bounce_count').eq('email', email).maybeSingle();
    const prev = cur.data?.bounce_count ? Number(cur.data.bounce_count) : 0;
    const next = prev + 1;

    await supabase
      .from('email_bounces')
      .upsert(
        [
          {
            email,
            bounce_count: next,
            last_bounced_at: now,
            provider: provider || null,
            bounce_type: bounceType || null,
            reason: reason || null,
            raw: body || {},
            updated_at: now,
          },
        ],
        { onConflict: 'email' },
      );

    await supabase
      .from('newsletter_subscriptions')
      .update({ consent: false })
      .eq('email', email);

    await supabase.from('admin_logs').insert([
      {
        admin_email: 'webhook',
        admin_name: 'EmailBounce',
        action: 'EMAIL_BOUNCE',
        target_id: email,
        details: { email, provider: provider || null, type: bounceType || null, reason: reason || null, bounce_count: next, createdAt: now },
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
