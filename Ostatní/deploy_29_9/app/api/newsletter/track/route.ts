import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getPublicBaseUrl } from '@/lib/public-base-url';
import { guardPublicGetRaw } from '@/lib/public-post-guard';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(req: Request) {
  try {
    const g = await guardPublicGetRaw(req, { keyPrefix: 'nl_track', windowMs: 60_000, max: 200 });
    if (!g.ok) return g.response;
    const ip = g.ip;

    const { searchParams } = new URL(req.url);
    const n = searchParams.get('n');
    const e = searchParams.get('e');
    const url = searchParams.get('url');
    const open = searchParams.get('open');
    const v = searchParams.get('v');

    const supabase = getServerSupabase();
    
    const ip_address = ip;
    const user_agent = String(req.headers.get('user-agent') || 'unknown').slice(0, 300);

    const newsletterId = String(n || '').trim();
    const isValidNewsletterId = !!newsletterId && isUuid(newsletterId);

    const target = (() => {
      if (!url) return null;
      try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return u;
      } catch {
        return null;
      }
    })();

    if (isValidNewsletterId) {
      const exists = await supabase
        .from('newsletter')
        .select('id')
        .eq('id', newsletterId)
        .maybeSingle();
      if (exists.error) throw exists.error;
      if (!exists.data?.id) {
        if (open === '1') {
          const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
          return new NextResponse(pixel, {
            headers: {
              'Content-Type': 'image/gif',
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          });
        }
        return target ? NextResponse.redirect(getPublicBaseUrl()) : NextResponse.json({ ok: true });
      }

      const eventType = open === '1' ? 'open' : 'click';
      
      // Pokusíme se uložit událost
      await supabase.from('newsletter_events').insert([{
        newsletter_id: newsletterId,
        email: e || null,
        variant: v || null,
        event_type: eventType,
        link_url: target ? target.toString().slice(0, 1000) : null,
        ip_address,
        user_agent
      }]);

      // Inkrementace čítačů v tabulce newsletter (bezpečně přes server)
      if (eventType === 'open') {
        await supabase.rpc('increment_newsletter_open', { n_id: n });
      } else {
        await supabase.rpc('increment_newsletter_click', { n_id: n });
      }
    }

    if (open === '1') {
      // Vrátime 1x1 transparentní GIF pro open tracking
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new NextResponse(pixel, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    if (url) {
      // Přesměrujeme na cílovou URL u click tracking
      if (!target) return NextResponse.redirect(getPublicBaseUrl());
      return NextResponse.redirect(target);
    }

    return NextResponse.json({ ok: true });
  } catch {
    // V případě chyby (např. db error) se snažíme nebránit přesměrování
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (url) {
      try {
        const u = new URL(url);
        if (u.protocol === 'http:' || u.protocol === 'https:') return NextResponse.redirect(u);
      } catch {}
      return NextResponse.redirect(getPublicBaseUrl());
    }
    
    // Fallback pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return new NextResponse(pixel, { headers: { 'Content-Type': 'image/gif' } });
  }
}
