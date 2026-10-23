import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';

function extractLocs(xml: string) {
  const out: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push(m[1]);
  }
  return out;
}

async function checkUrl(url: string) {
  const res = await fetch(url, { redirect: 'manual' });
  return { url, status: res.status };
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const base = new URL(req.url).origin;
    const sitemapRes = await fetch(`${base}/sitemap.xml`, { redirect: 'manual' });
    if (!sitemapRes.ok) throw new Error('SitemapFetchFailed');
    const xml = await sitemapRes.text();
    const urls = extractLocs(xml).slice(0, 200);

    const results: { url: string; status: number }[] = [];
    for (const u of urls) {
      try {
        results.push(await checkUrl(u));
      } catch {
        results.push({ url: u, status: 0 });
      }
    }

    const broken = results.filter((r) => r.status === 0 || r.status >= 400);
    return NextResponse.json({ ok: true, base, scanned: results.length, broken });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

