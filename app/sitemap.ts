import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getPublicBaseUrl } from '@/lib/public-base-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicBaseUrl();

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
    '/cs/burza',
    '/en/burza',
    '/cs/faq',
    '/en/faq',
    '/cs/galerie',
    '/en/galerie',
    '/cs/harmonogram',
    '/en/harmonogram',
    '/cs/kariera',
    '/en/kariera',
    '/cs/kvizy',
    '/en/kvizy',
    '/cs/oteviraci-doba',
    '/en/oteviraci-doba',
    '/cs/o-nas',
    '/en/o-nas',
    '/cs/partaci',
    '/en/partaci',
    '/cs/predmety',
    '/en/predmety',
    '/cs/pruvodce',
    '/en/pruvodce',
    '/cs/qr',
    '/en/qr',
    '/cs/kontakt',
    '/en/kontakt',
    '/cs/mapa',
    '/en/mapa',
    '/cs/roman',
    '/en/roman',
    '/cs/slevy',
    '/en/slevy',
    '/cs/sos',
    '/en/sos',
    '/cs/tos',
    '/en/tos',
    '/cs/cookies',
    '/en/cookies',
    '/cs/ochrana-soukromi',
    '/en/ochrana-soukromi',
    '/cs/ztraty-a-nalezy',
    '/en/ztraty-a-nalezy',
  ].map((url) => ({
    url: `${baseUrl}${url}`,
    lastModified: new Date(),
  }));

  return [...staticUrls, ...postUrls, ...eventUrls];
}
