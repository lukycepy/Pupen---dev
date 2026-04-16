import { getServerSupabase } from '@/lib/supabase-server';

export async function getSitePageContent(slug: string, lang: 'cs' | 'en') {
  let supabase: any;
  try {
    supabase = getServerSupabase();
  } catch {
    return null;
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
