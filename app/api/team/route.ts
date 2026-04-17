import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let supabase: any;
  try {
    supabase = getServerSupabase();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return NextResponse.json({ error: 'Missing Supabase env' }, { status: 500 });
    }
    supabase = createClient(url, anon);
  }
  const res = await supabase
    .from('team_members')
    .select('id,name,role,email,phone,image_url,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200);

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

  const out = NextResponse.json({ ok: true, items: res.data || [] });
  out.headers.set('Cache-Control', 'no-store');
  return out;
}
