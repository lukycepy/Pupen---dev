import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getBearerToken } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'blog_submit',
      windowMs: 60_000,
      max: 5,
      honeypotResponse: { ok: true, status: 'created' },
      tooManyMessage: 'Příliš mnoho požadavků. Zkuste to za chvíli.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const title = String(body?.title || '').trim();
    const content = String(body?.content || '').trim();
    const author_name = String(body?.author_name || '').trim();
    const author_email = String(body?.author_email || '').trim();

    if (!title || !content || !author_email) {
      return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const token = getBearerToken(req);
    let userId: string | null = null;
    if (token) {
      const r = await supabase.auth.getUser(token);
      userId = r.data?.user?.id || null;
    }
    
    // Server-side insert (Service Role obchází RLS, takže můžeme později RLS vypnout pro public)
    const { error } = await supabase
      .from('student_blog')
      .insert([{
        title: title.slice(0, 200),
        content: content.slice(0, 10_000),
        author_name: author_name ? author_name.slice(0, 120) : null,
        author_email: author_email.slice(0, 254),
        user_id: userId,
        status: 'pending'
      }]);

    if (error) throw error;

    return NextResponse.json({ ok: true, status: 'created' });
  } catch (error: any) {
    console.error('Blog submit error:', error);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }
}
