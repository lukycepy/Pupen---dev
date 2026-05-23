import { useEffect, useState } from 'react';

export function useSitePageContent(slug: string, lang: string) {
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [blocks, setBlocks] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = new URL('/api/site-page', window.location.origin);
        url.searchParams.set('slug', slug);
        url.searchParams.set('lang', lang === 'en' ? 'en' : 'cs');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (mounted) {
            setTitle('');
            setHtml('');
            setBlocks(null);
          }
          return;
        }
        const page = json?.page || null;
        if (mounted) {
          setTitle(String(page?.title || ''));
          setHtml(String(page?.content_html || ''));
          setBlocks(Array.isArray(page?.content_blocks) ? page.content_blocks : null);
        }
      } catch {
        if (mounted) {
          setTitle('');
          setHtml('');
          setBlocks(null);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug, lang]);

  return { title, html, blocks };
}
