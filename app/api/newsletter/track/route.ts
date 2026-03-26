import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const n = searchParams.get('n');
    const e = searchParams.get('e');
    const url = searchParams.get('url');
    const open = searchParams.get('open');
    const v = searchParams.get('v');

    const supabase = getServerSupabase();
    
    const ip_address = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const user_agent = req.headers.get('user-agent') || 'unknown';

    if (n) {
      const eventType = open === '1' ? 'open' : 'click';
      
      // Pokusíme se uložit událost
      await supabase.from('newsletter_events').insert([{
        newsletter_id: n,
        email: e || null,
        variant: v || null,
        event_type: eventType,
        link_url: url || null,
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
      return NextResponse.redirect(new URL(url));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // V případě chyby (např. db error) se snažíme nebránit přesměrování
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (url) {
      return NextResponse.redirect(new URL(url));
    }
    
    // Fallback pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return new NextResponse(pixel, { headers: { 'Content-Type': 'image/gif' } });
  }
}
