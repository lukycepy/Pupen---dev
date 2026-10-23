import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';

interface SitePageContentRow {
  slug?: string | null;
  lang?: 'cs' | 'en' | null;
  title?: string | null;
  content_html?: string | null;
  content_blocks?: unknown;
  updated_at?: string | null;
}

interface SitePageContentResponse {
  data: SitePageContentRow | null;
  error: Error | null;
}

interface SitePageContentQuery {
  eq(column: string, value: string): SitePageContentQuery;
  maybeSingle(): PromiseLike<SitePageContentResponse>;
}

interface SitePageContentClient {
  from(table: 'site_page_contents'): {
    select(columns: string): SitePageContentQuery;
  };
}

export async function getSitePageContent(slug: string, lang: 'cs' | 'en') {
  let supabase: SitePageContentClient;
  try {
    supabase = getServerSupabase() as unknown as SitePageContentClient;
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return null;
    supabase = createClient(url, anon) as unknown as SitePageContentClient;
  }
  const res = await supabase
    .from('site_page_contents')
    .select('slug,lang,title,content_html,content_blocks,updated_at')
    .eq('slug', slug)
    .eq('lang', lang)
    .maybeSingle();
  if (res.error) return null;
  return res.data || null;
}
