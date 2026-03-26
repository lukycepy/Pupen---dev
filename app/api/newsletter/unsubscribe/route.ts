import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `nl_unsub:${ip}`, windowMs: 10 * 60_000, max: 30 });
    if (!rl.ok) return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to později.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email || '');

    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    
    // Instead of deleting, we set consent = false
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
