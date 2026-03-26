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

    const countRes = await supabase.from('post_reactions').select('id', { count: 'exact', head: true }).eq('post_id', postId);
    if (countRes.error) throw countRes.error;
    const likes = countRes.count || 0;

    const user = await optionalUser(req);
    let mine: string | null = null;
    if (user) {
      const myRes = await supabase.from('post_reactions').select('reaction').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
      if (!myRes.error) mine = myRes.data?.reaction ? String(myRes.data.reaction) : null;
    }

    return NextResponse.json({ ok: true, likes, mine });
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
    const on = body?.on === false ? false : true;
    const reaction = String(body?.reaction || 'like').slice(0, 20) || 'like';
    if (reaction !== 'like') return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });

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

    if (on) {
      const up = await supabase
        .from('post_reactions')
        .upsert([{ post_id: postId, user_id: user.id, reaction }], { onConflict: 'post_id,user_id' });
      if (up.error) throw up.error;
    } else {
      const del = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id);
      if (del.error) throw del.error;
    }

    const countRes = await supabase.from('post_reactions').select('id', { count: 'exact', head: true }).eq('post_id', postId);
    if (countRes.error) throw countRes.error;
    const likes = countRes.count || 0;

    return NextResponse.json({ ok: true, likes, mine: on ? reaction : null });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

