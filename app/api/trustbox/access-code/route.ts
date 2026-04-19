import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeCode(input: string) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);
}

function randomToken() {
  return randomBytes(32).toString('base64url');
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'trustbox_access_code',
      windowMs: 60_000,
      max: 50,
      honeypotResponse: { ok: true },
    });
    if (!g.ok) return g.response;
    const body = g.body || {};
    const code = normalizeCode(String(body?.code || '').trim());
    if (!code) return NextResponse.json({ error: 'Chybí kód.' }, { status: 400 });

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();
    const codeHash = sha256Hex(code);

    const res = await supabase
      .from('trust_box_access_tokens')
      .select('thread_id, expires_at')
      .eq('code_hash', codeHash)
      .maybeSingle();
    if (res.error) throw res.error;
    const row: any = res.data;
    if (!row?.thread_id) return NextResponse.json({ error: 'Neplatný kód.' }, { status: 400 });
    if (String(row.expires_at) <= nowIso) return NextResponse.json({ error: 'Platnost vypršela.' }, { status: 400 });

    const token = randomToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = row.expires_at;
    const ins = await supabase.from('trust_box_access_tokens').insert([
      { thread_id: row.thread_id, token_hash: tokenHash, expires_at: expiresAt },
    ]);
    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true, token });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

