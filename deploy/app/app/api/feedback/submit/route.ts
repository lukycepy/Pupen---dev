import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'event_feedback',
      windowMs: 60_000,
      max: 3,
      honeypotResponse: { ok: true, status: 'created' },
      tooManyMessage: 'Příliš mnoho požadavků. Zkuste to za chvíli.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const event_id = String(body?.event_id || '').trim();
    const rating = body?.rating;
    const comment = body?.comment;

    // Základní validace
    if (!event_id) {
      return NextResponse.json({ error: 'Chybí ID akce' }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event_id);
    if (!isUuid) {
      return NextResponse.json({ error: 'Neplatné ID akce' }, { status: 400 });
    }
    
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Neplatné hodnocení' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const ev = await supabase.from('events').select('id').eq('id', event_id).maybeSingle();
    if (ev.error) throw ev.error;
    if (!ev.data?.id) return NextResponse.json({ error: 'Akce nenalezena' }, { status: 404 });
    
    // Server-side insert (obchází RLS pro public, takže můžeme později RLS zrušit)
    const { error } = await supabase
      .from('event_feedback')
      .insert([{ 
        event_id, 
        rating, 
        comment: comment ? String(comment).substring(0, 1000) : null
      }]);

    if (error) throw error;

    return NextResponse.json({ ok: true, status: 'created' });
  } catch (error: any) {
    console.error('Feedback submit error:', error);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }
}
