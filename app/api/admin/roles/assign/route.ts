import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { PROFILE_PERMISSION_KEYS_SET } from '@/lib/rbac/registry';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes("Could not find the table") && msg.includes("in the schema cache");
}

const PROFILE_BOOL_FIELDS = PROFILE_PERMISSION_KEYS_SET;

async function recomputeProfilePermissions(supabase: ReturnType<typeof getServerSupabase>, userId: string) {
  const rolesRes = await supabase
    .from('app_user_roles')
    .select('role_id, app_roles:role_id (permissions)')
    .eq('user_id', userId);
  if (rolesRes.error) throw rolesRes.error;

  const computed: any = {};
  for (const k of PROFILE_BOOL_FIELDS) computed[k] = false;
  let roleTrustBox = false;

  for (const row of rolesRes.data || []) {
    const perms = (row as any)?.app_roles?.permissions || {};
    for (const [k, v] of Object.entries(perms)) {
      if (!PROFILE_BOOL_FIELDS.has(k)) continue;
      if (v) computed[k] = true;
    }
    if ((perms as any)?.trustbox_admin) roleTrustBox = true;
  }

  await supabase.from('profiles').update(computed).eq('id', userId).throwOnError();

  if (roleTrustBox) {
    const existing = await supabase.from('trust_box_admins').select('user_id, can_view_pii').eq('user_id', userId).maybeSingle();
    if (!existing.error && !existing.data) {
      await supabase.from('trust_box_admins').insert([{ user_id: userId, can_view_pii: false }]).throwOnError();
    }
  }
  return computed;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toLowerCase();
    let userId = String(body?.userId || '').trim();
    const email = body?.email ? String(body.email).trim().toLowerCase() : '';
    const roleId = body?.roleId ? String(body.roleId) : '';

    const supabase = getServerSupabase();
    if (!userId && email) {
      const p = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
      if (p.error) throw p.error;
      userId = p.data?.id ? String(p.data.id) : '';
    }
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (action === 'unassign' && roleId) {
      await supabase.from('app_user_roles').delete().eq('user_id', userId).eq('role_id', roleId).throwOnError();
      const computed = await recomputeProfilePermissions(supabase, userId);
      await supabase
        .from('admin_logs')
        .insert([
          {
            admin_email: user.email || 'admin',
            admin_name: user.user_metadata?.full_name || user.email || 'admin',
            action: 'ROLE_UNASSIGN',
            target_id: userId,
            details: { email: email || null, role_id: roleId, permissionKeys: Object.keys(computed).filter((k) => computed[k]) },
          },
        ])
        .throwOnError();
      return NextResponse.json({ ok: true });
    }

    if (!roleId) {
      await supabase.from('app_user_roles').delete().eq('user_id', userId).throwOnError();
      const computed = await recomputeProfilePermissions(supabase, userId);
      await supabase
        .from('admin_logs')
        .insert([
          {
            admin_email: user.email || 'admin',
            admin_name: user.user_metadata?.full_name || user.email || 'admin',
            action: 'ROLE_CLEAR',
            target_id: userId,
            details: { ...(email ? { email } : {}), permissionKeys: Object.keys(computed).filter((k) => computed[k]) },
          },
        ])
        .throwOnError();
      return NextResponse.json({ ok: true });
    }

    const roleRes = await supabase.from('app_roles').select('id,name,permissions').eq('id', roleId).single();
    if (roleRes.error) throw roleRes.error;
    const role: any = roleRes.data;

    await supabase
      .from('app_user_roles')
      .upsert(
        [{ user_id: userId, role_id: roleId, assigned_at: new Date().toISOString(), assigned_by_email: user.email || null }],
        { onConflict: 'user_id,role_id' },
      )
      .throwOnError();

    const computed = await recomputeProfilePermissions(supabase, userId);

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'ROLE_ASSIGN',
          target_id: userId,
          details: { email: email || null, role_id: roleId, role_name: role?.name || null, permissionKeys: Object.keys(computed).filter((k) => computed[k]) },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) {
      return NextResponse.json(
        {
          error:
            "Role nejsou v DB vytvořené. Spusť migraci `migrace/26_app_roles.sql` v Supabase (SQL editor) a případně restartuj API, aby se obnovil schema cache.",
        },
        { status: 501 },
      );
    }
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
