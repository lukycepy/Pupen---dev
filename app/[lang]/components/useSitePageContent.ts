import { useEffect, useState } from 'react';

export function useSitePageContent(slug: string, lang: string) {
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = new URL('/api/site-page', window.location.origin);
        url.searchParams.set('slug', slug);
        url.searchParams.set('lang', lang === 'en' ? 'en' : 'cs');
        const res = await fetch(url.toString());
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const page = json?.page || null;
        if (mounted) {
          setTitle(String(page?.title || ''));
          setHtml(String(page?.content_html || ''));
        }
      } catch {
        if (mounted) {
          setTitle('');
          setHtml('');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug, lang]);

  return { title, html };
}

