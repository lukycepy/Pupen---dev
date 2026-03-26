import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

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
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email || '');
    const categories = normalizeCategories(body?.categories);

    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .update({ 
        categories, 
        consent: true, // If they update preferences, they consent
        updated_at: new Date().toISOString() 
      })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({ ok: true, status: 'preferences_updated' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = normalizeEmail(searchParams.get('email') || '');
    
    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('categories, consent')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // ignore not found
    
    return NextResponse.json({ 
      preferences: data || { categories: ['all'], consent: false },
      exists: !!data
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
