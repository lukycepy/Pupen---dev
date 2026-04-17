import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';

export async function getSitePageContent(slug: string, lang: 'cs' | 'en') {
  let supabase: any;
  try {
    supabase = getServerSupabase();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return null;
    supabase = createClient(url, anon);
  }
  const res = await supabase
    .from('site_page_contents')
    .select('slug,lang,title,content_html,updated_at')
    .eq('slug', slug)
    .eq('lang', lang)
    .maybeSingle();
  if (res.error) return null;
  return res.data || null;
}
