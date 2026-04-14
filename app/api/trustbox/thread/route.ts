import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicGet, guardPublicJsonPost } from '@/lib/public-post-guard';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export async function GET(req: Request) {
  try {
    const g = await guardPublicGet(req, { keyPrefix: 'trustbox_thread_get', windowMs: 60_000, max: 120 });
    if (!g.ok) return g.response;
    const url = new URL(req.url);
    const token = String(url.searchParams.get('token') || '').trim();
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const supabase = getServerSupabase();
    const tokenHash = sha256Hex(token);
    const tok = await supabase
      .from('trust_box_access_tokens')
      .select('thread_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (tok.error) throw tok.error;
    const row: any = tok.data;
    if (!row) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    const threadRes = await supabase.from('trust_box_threads').select('*').eq('id', row.thread_id).maybeSingle();
    if (threadRes.error) throw threadRes.error;
    const thread: any = threadRes.data;
    if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const msgsRes = await supabase
      .from('trust_box_messages')
      .select('id, author_type, body, created_at')
      .eq('thread_id', row.thread_id)
      .order('created_at', { ascending: true });
    if (msgsRes.error) throw msgsRes.error;

    return NextResponse.json({
      ok: true,
      thread: {
        id: thread.id,
        status: thread.status,
        priority: thread.priority,
        category: thread.category,
        subject: thread.subject,
        created_at: thread.created_at,
        anonymized_at: thread.anonymized_at,
      },
      messages: msgsRes.data || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'trustbox_thread_post',
      windowMs: 60_000,
      max: 30,
      honeypotResponse: { ok: true },
    });
    if (!g.ok) return g.response;
    const body = g.body || {};

    const token = String(body?.token || '').trim();
    const message = String(body?.message || '').trim().slice(0, 10_000);
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

    const supabase = getServerSupabase();
    const tokenHash = sha256Hex(token);
    const tok = await supabase
      .from('trust_box_access_tokens')
      .select('thread_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (tok.error) throw tok.error;
    const row: any = tok.data;
    if (!row) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    const ins = await supabase.from('trust_box_messages').insert([{ thread_id: row.thread_id, author_type: 'reporter', body: message }]);
    if (ins.error) throw ins.error;
    const upd = await supabase.from('trust_box_threads').update({ last_activity_at: new Date().toISOString() }).eq('id', row.thread_id);
    if (upd.error) throw upd.error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

