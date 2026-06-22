import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { PROFILE_PERMISSION_KEYS_SET } from '@/lib/rbac/registry';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';

interface RoleRow {
  id?: string | null;
  name?: string | null;
  permissions?: Record<string, unknown> | null;
  color_hex?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

interface AssignmentRow {
  user_id?: string | null;
  role_id?: string | null;
  assigned_at?: string | null;
  assigned_by_email?: string | null;
}

interface ProfileListRow {
  id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

type PermissionsMap = Record<string, boolean>;

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

const ALLOWED_PROFILE_FIELDS = new Set([...PROFILE_PERMISSION_KEYS_SET, 'trustbox_admin']);

function pickPermissions(input: unknown): PermissionsMap {
  const out: PermissionsMap = {};
  for (const [k, v] of Object.entries(toRecord(input))) {
    if (!ALLOWED_PROFILE_FIELDS.has(k)) continue;
    out[k] = !!v;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const supabase = getServerSupabase();
    const roles = await withSchemaCacheRetry(supabase, () =>
      supabase.from('app_roles').select('id,name,permissions,color_hex,updated_at,created_at').order('name', { ascending: true }),
    );
    if (roles.error) throw roles.error;

    const assignmentsRes = await withSchemaCacheRetry(supabase, () =>
      supabase.from('app_user_roles').select('user_id, role_id, assigned_at, assigned_by_email').order('assigned_at', { ascending: false }),
    );
    if (assignmentsRes.error) throw assignmentsRes.error;
    const assignments = assignmentsRes.data || [] as AssignmentRow[];

    const userIds = Array.from(new Set(assignments.map((a) => String(a.user_id)).filter(Boolean)));
    let profilesById: Record<string, ProfileListRow> = {};
    if (userIds.length) {
      const profRes = await withSchemaCacheRetry(supabase, () => supabase.from('profiles').select('id,email,first_name,last_name').in('id', userIds));
      if (profRes.error) throw profRes.error;
      profilesById = Object.fromEntries(((profRes.data || []) as ProfileListRow[]).map((p) => [String(p.id), p]));
    }
    const assignmentsWithProfiles = assignments.map((a) => ({ ...a, profiles: profilesById[String(a.user_id)] || null }));

    return NextResponse.json({
      ok: true,
      roles: roles.data || [],
      assignments: assignmentsWithProfiles,
      permissionKeys: Array.from(ALLOWED_PROFILE_FIELDS),
    });
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

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const roleId = body.id ? String(body.id) : null;
    const name = String(body.name || '').trim();
    const colorHex = String(body.color_hex || body.colorHex || '').trim() || '#16a34a';
    const permissions = pickPermissions(body.permissions);
    if (!name || name.length < 2) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date().toISOString();
    const up = await withSchemaCacheRetry(supabase, () =>
      roleId
        ? supabase
            .from('app_roles')
            .update({ name, permissions, color_hex: colorHex, updated_at: now })
            .eq('id', roleId)
            .select('id,name,permissions,color_hex,updated_at,created_at')
            .single<RoleRow>()
        : supabase
            .from('app_roles')
            .insert([{ name, permissions, color_hex: colorHex, updated_at: now }])
            .select('id,name,permissions,color_hex,updated_at,created_at')
            .single<RoleRow>(),
    );
    if (up.error) throw up.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: roleId ? 'ROLE_UPDATE' : 'ROLE_CREATE',
          target_id: String(up.data.id),
          details: { name, color_hex: colorHex, permissionKeys: Object.keys(permissions) },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, role: up.data });
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
