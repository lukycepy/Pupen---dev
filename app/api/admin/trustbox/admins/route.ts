import { NextResponse } from 'next/server';
import { requireAdmin, requireTrustBoxAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

export async function GET(req: Request) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('trust_box_admins')
      .select('user_id, can_view_pii, created_at, profiles(email, first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, items: res.data || [], isSuperadmin: auth.isSuperadmin });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || '').trim();
    const canViewPii = body?.canViewPii === true;
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const supabase = getServerSupabase();
    const ins = await supabase
      .from('trust_box_admins')
      .upsert([{ user_id: userId, can_view_pii: canViewPii }], { onConflict: 'user_id' });
    if (ins.error) throw ins.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'TRUSTBOX_ADMIN_ADD',
          target_id: userId,
          details: { can_view_pii: canViewPii },
        },
      ])
      .throwOnError();

    await logTrustBoxAudit({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'ADMIN_ADD_ADMIN',
      piiAccessed: false,
      reason: `${userId} can_view_pii=${canViewPii ? 'true' : 'false'}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
