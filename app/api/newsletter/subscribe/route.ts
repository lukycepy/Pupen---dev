import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';

function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
}

function isEmail(input: string) {
  const v = normalizeEmail(input);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizeCategories(input: any): string[] {
  const arr = Array.isArray(input) ? input : [];
  const cats = Array.from(new Set(arr.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!cats.length) return ['all'];
  if (cats.includes('all')) return ['all'];
  return cats;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `nl_sub:${ip}`, windowMs: 10 * 60_000, max: 30 });
    if (!rl.ok) return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to později.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email || '');
    const categories = normalizeCategories(body?.categories);
    const source = body?.source != null ? String(body.source).slice(0, 80) : 'web';

    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });
    if (!isEmail(email)) return NextResponse.json({ error: 'Neplatný e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const existing = await supabase
      .from('newsletter_subscriptions')
      .select('id,email,categories,consent')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;

    if (existing.data?.id) {
      const up = await supabase
        .from('newsletter_subscriptions')
        .update({ categories, consent: true, source })
        .eq('id', existing.data.id);
      if (up.error) throw up.error;
      return NextResponse.json({ ok: true, status: 'updated' });
    }

    const ins = await supabase.from('newsletter_subscriptions').insert([{ email, categories, consent: true, source }]);
    if (ins.error) throw ins.error;
    return NextResponse.json({ ok: true, status: 'created' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

