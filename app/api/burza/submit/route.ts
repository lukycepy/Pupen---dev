import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export async function POST(req: Request) {
  return NextResponse.json({ error: 'Burza učebnic je ukončena.' }, { status: 410 });
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'book_exchange',
      windowMs: 60_000,
      max: 5,
      honeypotResponse: { ok: true, status: 'created' },
      tooManyMessage: 'Příliš mnoho požadavků. Zkuste to za chvíli.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const title = String(body?.title || '').trim();
    const author = String(body?.author || '').trim();
    const price = body?.price;
    const contact = String(body?.contact || '').trim();

    if (!title || !author || !price || !contact) {
      return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    
    // Server-side insert obchází RLS, takže můžeme později RLS public insert smazat
    const { error } = await supabase
      .from('book_exchange')
      .insert([{ 
        title: title.slice(0, 200), 
        author: author.slice(0, 120), 
        price: typeof price === 'number' ? price : String(price).slice(0, 32), 
        contact: contact.slice(0, 220), 
        status: 'pending', 
        is_sold: false 
      }]);

    if (error) throw error;

    return NextResponse.json({ ok: true, status: 'created' });
  } catch (error: any) {
    console.error('Book exchange submit error:', error);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }
}
