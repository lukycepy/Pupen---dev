import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireSuperadmin } from '@/lib/server-auth';
import { getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireSuperadmin(req);
    const { id } = await ctx.params;
    const banId = Number(id);
    if (!Number.isFinite(banId) || banId < 1) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const ip = getClientIp(req) || null;
    const supabase = getServerSupabase();
    const up = await supabase
      .from('security_bans')
      .update({
        updated_at: new Date().toISOString(),
        active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revoked_from_ip: ip && ip !== 'unknown' ? ip : null,
      })
      .eq('id', banId)
      .select('*')
      .maybeSingle();
    if (up.error) throw up.error;
    if (!up.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'SECURITY_BAN_REVOKE',
          target_id: `security_bans:${banId}`,
          details: {},
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, ban: up.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : e?.message === 'Banned' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

