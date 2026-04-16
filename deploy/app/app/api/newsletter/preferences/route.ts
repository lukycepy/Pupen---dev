import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
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
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'nl_prefs',
      windowMs: 60_000,
      max: 20,
      honeypotResponse: { ok: true, status: 'preferences_updated' },
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const user = await requireUser(req);
    const email = normalizeEmail(user.email || '');
    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const categories = normalizeCategories(body?.categories);

    const supabase = getServerSupabase();
    
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .upsert(
        [
          {
            email,
            categories,
            consent: true,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'email' },
      );

    if (error) throw error;

    return NextResponse.json({ ok: true, status: 'preferences_updated' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const email = normalizeEmail(user.email || '');
    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('categories, consent')
      .eq('email', email)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error; // ignore not found
    
    return NextResponse.json({ 
      preferences: data || { categories: ['all'], consent: false },
      exists: !!data
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
