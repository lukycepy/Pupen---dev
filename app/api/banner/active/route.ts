import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const res = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw res.error;

    const out = NextResponse.json({ ok: true, banner: res.data || null });
    out.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return out;
  } catch {
    const out = NextResponse.json({ ok: true, banner: null });
    out.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return out;
  }
}
