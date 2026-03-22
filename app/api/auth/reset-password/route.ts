import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes("Could not find the table") && msg.includes("in the schema cache");
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    const password = String(body?.password || '');

    if (!token || token.length < 32) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: 'Invalid password' }, { status: 400 });

    const supabase = getServerSupabase();
    const tokenHash = sha256Hex(token);

    const res = await supabase
      .from('password_resets')
      .select('user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (res.error) throw res.error;
    const row: any = res.data;
    if (!row?.user_id) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (row.used_at) return NextResponse.json({ error: 'Token used' }, { status: 400 });
    const expiresAt = row.expires_at ? Date.parse(String(row.expires_at)) : 0;
    if (!expiresAt || Number.isNaN(expiresAt) || Date.now() > expiresAt) return NextResponse.json({ error: 'Token expired' }, { status: 400 });

    const upd = await supabase.auth.admin.updateUserById(String(row.user_id), { password });
    if (upd.error) throw upd.error;

    await supabase
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) {
      return NextResponse.json(
        {
          error:
            "Reset hesla přes token není v databázi nakonfigurovaný (chybí tabulka). Použijte odkaz z e-mailu pro reset hesla, nebo aplikujte DB migrace.",
        },
        { status: 501 },
      );
    }
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
