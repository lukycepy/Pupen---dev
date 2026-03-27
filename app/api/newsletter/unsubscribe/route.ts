import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
}

async function extractEmail(req: Request) {
  const { searchParams } = new URL(req.url);
  const fromQuery = normalizeEmail(searchParams.get('email') || '');
  if (fromQuery) return fromQuery;

  const ct = String(req.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return normalizeEmail(body?.email || '');
  }

  const raw = await req.text().catch(() => '');
  const sp = new URLSearchParams(raw);
  const fromForm = normalizeEmail(sp.get('email') || '');
  if (fromForm) return fromForm;

  return '';
}

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `nl_unsub:${ip}`, windowMs: 10 * 60_000, max: 30 });
    if (!rl.ok) return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to později.' }, { status: 429 });

    const email = await extractEmail(req);
    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .update({ consent: false, updated_at: new Date().toISOString() })
      .eq('email', email);

    if (error) throw error;
    return NextResponse.json({ ok: true, status: 'unsubscribed' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `nl_unsub:${ip}`, windowMs: 10 * 60_000, max: 30 });
    if (!rl.ok) return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to později.' }, { status: 429 });

    const email = await extractEmail(req);

    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .update({ consent: false, updated_at: new Date().toISOString() })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({ ok: true, status: 'unsubscribed' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
