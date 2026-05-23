import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireSuperadmin } from '@/lib/server-auth';
import { getClientIp } from '@/lib/rate-limit';

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request) {
  try {
    await requireSuperadmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('security_bans')
      .select('id, created_at, updated_at, active, kind, ip, identity_id, reason, expires_at, created_by, revoked_at, revoked_by')
      .order('created_at', { ascending: false })
      .limit(500);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, bans: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSuperadmin(req);
    const body = await req.json().catch(() => ({}));
    const kind = String(body?.kind || body?.type || '').trim();
    const value = String(body?.value || '').trim();
    const reason = body?.reason ? String(body.reason).trim().slice(0, 800) : '';
    const expiresAtRaw = body?.expires_at ? String(body.expires_at).trim() : '';
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: 'Invalid expires_at' }, { status: 400 });

    if (!value) return NextResponse.json({ error: 'Missing value' }, { status: 400 });
    if (kind !== 'ip' && kind !== 'identity') return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    if (kind === 'identity' && !isUuid(value)) return NextResponse.json({ error: 'Invalid identity uuid' }, { status: 400 });

    const ip = getClientIp(req) || null;
    const supabase = getServerSupabase();

    const insertRow: any = {
      updated_at: new Date().toISOString(),
      active: true,
      kind,
      reason: reason || null,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      created_by: user.id,
      created_from_ip: ip && ip !== 'unknown' ? ip : null,
    };
    if (kind === 'ip') insertRow.ip = value;
    if (kind === 'identity') insertRow.identity_id = value;

    const created = await supabase.from('security_bans').insert([insertRow]).select('*').single();
    if (created.error) throw created.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'SECURITY_BAN_CREATE',
          target_id: `security_bans:${created.data?.id}`,
          details: { kind, value },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, ban: created.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : e?.message === 'Banned' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

