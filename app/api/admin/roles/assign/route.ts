import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { PROFILE_PERMISSION_KEYS_SET } from '@/lib/rbac/registry';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';

interface AppRolePermissionsRow {
  permissions?: Record<string, unknown> | null;
}

interface UserRoleJoinRow {
  app_roles?: AppRolePermissionsRow | AppRolePermissionsRow[] | null;
}

interface ProfileIdRow {
  id?: string | null;
}

interface AppRoleRow {
  name?: string | null;
}

type ComputedPermissions = Record<string, boolean>;

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isSchemaCacheMissingTable(error: unknown) {
  const msg = error instanceof Error ? error.message : '';
  return msg.includes("Could not find the table") && msg.includes("in the schema cache");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

const PROFILE_BOOL_FIELDS = PROFILE_PERMISSION_KEYS_SET;

async function recomputeProfilePermissions(supabase: ReturnType<typeof getServerSupabase>, userId: string) {
  const rolesRes = await withSchemaCacheRetry(supabase, () =>
    supabase.from('app_user_roles').select('role_id, app_roles:role_id (permissions)').eq('user_id', userId),
  );
  if (rolesRes.error) throw rolesRes.error;

  const computed: ComputedPermissions = {};
  for (const k of PROFILE_BOOL_FIELDS) computed[k] = false;
  let roleTrustBox = false;

  for (const row of (rolesRes.data || []) as UserRoleJoinRow[]) {
    const roleData = Array.isArray(row.app_roles) ? row.app_roles[0] : row.app_roles;
    const perms = toRecord(roleData?.permissions);
    for (const [k, v] of Object.entries(perms)) {
      if (!PROFILE_BOOL_FIELDS.has(k)) continue;
      if (v) computed[k] = true;
    }
    if (perms.trustbox_admin) roleTrustBox = true;
  }

  await withSchemaCacheRetry(supabase, () => supabase.from('profiles').update(computed).eq('id', userId).throwOnError());

  if (roleTrustBox) {
    const existing = await withSchemaCacheRetry(supabase, () =>
      supabase.from('trust_box_admins').select('user_id, can_view_pii').eq('user_id', userId).maybeSingle(),
    );
    if (!existing.error && !existing.data) {
      await withSchemaCacheRetry(supabase, () =>
        supabase.from('trust_box_admins').insert([{ user_id: userId, can_view_pii: false }]).throwOnError(),
      );
    }
  }
  return computed;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '').trim().toLowerCase();
    let userId = String(body.userId || '').trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : '';
    const roleId = body.roleId ? String(body.roleId) : '';

    const supabase = getServerSupabase();
    if (!userId && email) {
      const p = await withSchemaCacheRetry(supabase, () => supabase.from('profiles').select('id').eq('email', email).maybeSingle<ProfileIdRow>());
      if (p.error) throw p.error;
      userId = p.data?.id ? String(p.data.id) : '';
    }
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (action === 'unassign' && roleId) {
      await withSchemaCacheRetry(supabase, () =>
        supabase.from('app_user_roles').delete().eq('user_id', userId).eq('role_id', roleId).throwOnError(),
      );
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
      return NextResponse.json({ ok: true, computed, enabledKeys: Object.keys(computed).filter((k) => computed[k]) });
    }

    if (!roleId) {
      await withSchemaCacheRetry(supabase, () => supabase.from('app_user_roles').delete().eq('user_id', userId).throwOnError());
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
      return NextResponse.json({ ok: true, computed, enabledKeys: Object.keys(computed).filter((k) => computed[k]) });
    }

    const roleRes = await withSchemaCacheRetry(supabase, () => supabase.from('app_roles').select('id,name,permissions').eq('id', roleId).single<AppRoleRow>());
    if (roleRes.error) throw roleRes.error;
    const role = roleRes.data;

    await withSchemaCacheRetry(supabase, () =>
      supabase
        .from('app_user_roles')
        .upsert(
          [{ user_id: userId, role_id: roleId, assigned_at: new Date().toISOString(), assigned_by_email: user.email || null }],
          { onConflict: 'user_id,role_id' },
        )
        .throwOnError(),
    );

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

    return NextResponse.json({ ok: true, computed, enabledKeys: Object.keys(computed).filter((k) => computed[k]) });
  } catch (error: unknown) {
    if (isSchemaCacheMissingTable(error)) {
      return NextResponse.json(
        {
          error:
            "Role nejsou v DB vytvořené. Spusť migraci `supabase/migrations/20260414174635_26_app_roles.sql` v Supabase (SQL editor) a případně restartuj API, aby se obnovil schema cache.",
        },
        { status: 501 },
      );
    }
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
