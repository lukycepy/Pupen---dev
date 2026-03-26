import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getBearerToken, requireUser } from '@/lib/server-auth';

async function optionalUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    return await requireUser(req);
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const postId = String(id || '').trim();
    if (!postId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();
    const postRes = await supabase
      .from('posts')
      .select('id, published_at')
      .eq('id', postId)
      .not('published_at', 'is', null)
      .lte('published_at', nowIso)
      .maybeSingle();
    if (postRes.error) throw postRes.error;
    if (!postRes.data?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const user = await optionalUser(req);

    const base = supabase
      .from('post_comments')
      .select('id, created_at, user_id, author_name, body, status')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(300);

    const res = user
      ? await base.or(`status.eq.approved,and(status.eq.pending,user_id.eq.${user.id})`)
      : await base.eq('status', 'approved');

    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, comments: res.data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const postId = String(id || '').trim();
    if (!postId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const text = String(body?.body || body?.text || '').trim();
    if (!text) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    if (text.length > 2000) return NextResponse.json({ error: 'Too long' }, { status: 400 });

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();
    const postRes = await supabase
      .from('posts')
      .select('id, published_at')
      .eq('id', postId)
      .not('published_at', 'is', null)
      .lte('published_at', nowIso)
      .maybeSingle();
    if (postRes.error) throw postRes.error;
    if (!postRes.data?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const profRes = await supabase.from('profiles').select('first_name,last_name').eq('id', user.id).maybeSingle();
    const p: any = profRes.data || {};
    const authorName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || (user.email || 'Member');

    const ins = await supabase
      .from('post_comments')
      .insert([
        {
          post_id: postId,
          user_id: user.id,
          author_email: user.email || null,
          author_name: authorName,
          body: text,
          status: 'pending',
        },
      ])
      .select('id, created_at, user_id, author_name, body, status')
      .single();
    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true, comment: ins.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

