import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { userId } = await params;
    const targetId = String(userId || '').trim();
    if (!targetId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const canViewPii = body?.canViewPii === true;

    const supabase = getServerSupabase();
    const upd = await supabase.from('trust_box_admins').update({ can_view_pii: canViewPii }).eq('user_id', targetId);
    if (upd.error) throw upd.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'TRUSTBOX_ADMIN_UPDATE',
          target_id: targetId,
          details: { can_view_pii: canViewPii },
        },
      ])
      .throwOnError();

    await logTrustBoxAudit({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'ADMIN_UPDATE_ADMIN_PERMS',
      piiAccessed: false,
      reason: `${targetId} can_view_pii=${canViewPii ? 'true' : 'false'}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { userId } = await params;
    const targetId = String(userId || '').trim();
    if (!targetId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const supabase = getServerSupabase();
    const del = await supabase.from('trust_box_admins').delete().eq('user_id', targetId);
    if (del.error) throw del.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'TRUSTBOX_ADMIN_REMOVE',
          target_id: targetId,
          details: {},
        },
      ])
      .throwOnError();

    await logTrustBoxAudit({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'ADMIN_REMOVE_ADMIN',
      piiAccessed: false,
      reason: targetId,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
