import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = String(url.searchParams.get('slug') || '').trim();
  const lang = (String(url.searchParams.get('lang') || 'cs').trim() === 'en' ? 'en' : 'cs') as 'cs' | 'en';
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const supabase = getServerSupabase();
  const res = await supabase
    .from('site_page_contents')
    .select('slug,lang,title,content_html,updated_at')
    .eq('slug', slug)
    .eq('lang', lang)
    .maybeSingle();
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

  const out = NextResponse.json({ ok: true, page: res.data || null });
  out.headers.set('Cache-Control', 'no-store');
  return out;
}

