import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import * as cheerio from 'cheerio';

function extractLocs(xml: string) {
  const out: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push(m[1]);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const base = new URL(req.url).origin;
    const sitemapRes = await fetch(`${base}/sitemap.xml`, { redirect: 'manual' });
    if (!sitemapRes.ok) throw new Error('SitemapFetchFailed');
    const xml = await sitemapRes.text();
    // Bereme prvních max 200 URL z důvodu výkonu a rate limitů
    const urls = extractLocs(xml).slice(0, 200);

    const results: any[] = [];
    
    // Zpracujeme sériově, ať si neusmažíme vlastní server
    for (const u of urls) {
      try {
        const res = await fetch(u, { redirect: 'manual' });
        if (!res.ok) {
          results.push({ url: u, status: res.status, error: 'Not OK' });
          continue;
        }
        const html = await res.text();
        const $ = cheerio.load(html);
        
        // Získáme canonical link
        const canonical = $('link[rel="canonical"]').attr('href');
        
        // Získáme hreflang
        const hreflangLinks: Record<string, string> = {};
        $('link[rel="alternate"][hreflang]').each((_, el) => {
          const lang = $(el).attr('hreflang');
          const href = $(el).attr('href');
          if (lang && href) {
            hreflangLinks[lang] = href;
          }
        });

        // Kontrola titulku a popisu
        const title = $('title').text();
        const metaDesc = $('meta[name="description"]').attr('content');
        const h1Count = $('h1').length;

        const issues: string[] = [];
        if (!canonical) issues.push('Missing canonical tag');
        else if (canonical !== u) issues.push(`Canonical mismatch: ${canonical}`);
        
        if (!hreflangLinks['cs'] || !hreflangLinks['en']) issues.push('Missing hreflang (cs or en)');
        if (!title || title.length < 5) issues.push('Title too short or missing');
        if (!metaDesc || metaDesc.length < 20) issues.push('Description too short or missing');
        if (h1Count === 0) issues.push('Missing H1 tag');
        if (h1Count > 1) issues.push('Multiple H1 tags');

        results.push({
          url: u,
          status: 200,
          canonical,
          hreflang: hreflangLinks,
          issues
        });
      } catch (e: any) {
        results.push({ url: u, status: 0, error: e.message });
      }
    }

    const withIssues = results.filter(r => r.issues?.length > 0 || r.error);
    
    return NextResponse.json({ 
      ok: true, 
      scanned: results.length, 
      issuesFound: withIssues.length,
      details: withIssues
    });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}