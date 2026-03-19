import { NextResponse } from 'next/server';

function allowedHost(hostname: string) {
  if (hostname === 'pupen.org' || hostname.endsWith('.pupen.org')) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return false;
}

function pickMeta(html: string, key: string) {
  const reProp = new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const reName = new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const m1 = html.match(reProp);
  if (m1?.[1]) return m1[1];
  const m2 = html.match(reName);
  if (m2?.[1]) return m2[1];
  return null;
}

function pickTitle(html: string) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() || null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const urlParam = searchParams.get('url');
    if (!urlParam) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    let target: URL;
    try {
      target = new URL(urlParam, 'https://pupen.org');
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
    }
    if (!allowedHost(target.hostname)) {
      return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });
    }

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': 'Pupen-OG-Preview/1.0' },
    }).finally(() => clearTimeout(t));

    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 400 });
    const html = await res.text();

    const ogTitle = pickMeta(html, 'og:title');
    const ogDescription = pickMeta(html, 'og:description');
    const ogImage = pickMeta(html, 'og:image');
    const ogUrl = pickMeta(html, 'og:url');
    const description = pickMeta(html, 'description');
    const title = ogTitle || pickTitle(html);

    return NextResponse.json({
      ok: true,
      inputUrl: urlParam,
      finalUrl: res.url,
      title,
      description: ogDescription || description,
      image: ogImage,
      url: ogUrl || res.url,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.name === 'AbortError' ? 'Timeout' : e?.message || 'Error' }, { status: 500 });
  }
}

