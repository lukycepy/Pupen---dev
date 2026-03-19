import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://pupen.org';

  // Fetch all posts and events
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasSupabase = !!supabaseUrl && !!supabaseKey;

  const now = new Date().toISOString();

  const supabase = hasSupabase ? createClient(supabaseUrl as string, supabaseKey as string) : null;

  const [posts, events] = await Promise.all([
    supabase
      ? supabase.from('posts').select('id, published_at').not('published_at', 'is', null).lte('published_at', now)
      : Promise.resolve({ data: [] as any[] } as any),
    supabase
      ? supabase.from('events').select('id, published_at').not('published_at', 'is', null).lte('published_at', now)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const postUrls = (posts.data || []).flatMap((post: any) => [
    {
      url: `${baseUrl}/cs/novinky/${post.id}`,
      lastModified: post.published_at || new Date(),
    },
    {
      url: `${baseUrl}/en/novinky/${post.id}`,
      lastModified: post.published_at || new Date(),
    },
  ]);

  const eventUrls = (events.data || []).flatMap((event: any) => [
    {
      url: `${baseUrl}/cs/akce/${event.id}`,
      lastModified: event.published_at || new Date(),
    },
    {
      url: `${baseUrl}/en/akce/${event.id}`,
      lastModified: event.published_at || new Date(),
    },
  ]);

  const staticUrls = [
    '',
    '/cs',
    '/en',
    '/cs/akce',
    '/en/akce',
    '/cs/novinky',
    '/en/novinky',
    '/cs/archiv',
    '/en/archiv',
    '/cs/o-nas',
    '/en/o-nas',
    '/cs/kontakt',
    '/en/kontakt',
    '/cs/mapa',
    '/en/mapa',
    '/cs/tos',
    '/en/tos',
    '/cs/cookies',
    '/en/cookies',
    '/cs/ochrana-soukromi',
    '/en/ochrana-soukromi',
  ].map((url) => ({
    url: `${baseUrl}${url}`,
    lastModified: new Date(),
  }));

  return [...staticUrls, ...postUrls, ...eventUrls];
}
