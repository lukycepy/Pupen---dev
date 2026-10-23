import { getClientIp } from '@/lib/rate-limit';
import { PROFILE_PERMISSION_KEYS_SET } from '@/lib/rbac/registry';
import { isRequestBanned } from '@/lib/security/bans';
import { getServerSupabase } from '@/lib/supabase-server';
import { getRlsSupabase } from '@/lib/supabase-rls';

interface AdminProfileRow {
  is_admin?: boolean | null;
  can_manage_admins?: boolean | null;
}

interface MemberProfileRow extends AdminProfileRow {
  is_member?: boolean | null;
  can_view_member_portal?: boolean | null;
  can_edit_member_portal?: boolean | null;
}

interface TrustBoxAdminRow {
  can_view_pii?: boolean | null;
}

interface AppRoleJoinRow {
  role_id?: string | null;
  app_roles?:
    | {
        id?: string | null;
        name?: string | null;
        permissions?: Record<string, unknown> | null;
      }
    | Array<{
        id?: string | null;
        name?: string | null;
        permissions?: Record<string, unknown> | null;
      }>
    | null;
}

interface LoginAliasRow {
  email?: string | null;
}

type EffectiveProfile = Record<string, unknown> & {
  is_admin?: boolean | null;
  is_member?: boolean | null;
  can_manage_admins?: boolean | null;
  can_view_member_portal?: boolean | null;
  can_edit_member_portal?: boolean | null;
  assigned_roles?: Array<{ id: string; name: string }>;
  login_aliases?: string[];
  has_admin_access?: boolean;
  has_member_access?: boolean;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Error');
  }
  return String(error || 'Error');
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function isMissingRelation(error: unknown, relation: string) {
  const message = getErrorMessage(error);
  return new RegExp(relation, 'i').test(message) && /(schema cache|does not exist|relation|table)/i.test(message);
}

function mergeRolePermissions(profile: EffectiveProfile, permissions: Record<string, unknown>) {
  for (const [key, value] of Object.entries(permissions)) {
    if (!PROFILE_PERMISSION_KEYS_SET.has(key)) continue;
    if (value === true) {
      profile[key] = true;
    }
  }
}

export function getBearerToken(req: Request) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1];

  const alt = req.headers.get('x-supabase-token') || '';
  const mm = String(alt).match(/^Bearer\s+(.+)$/i);
  if (mm?.[1]) return mm[1];
  if (alt && !alt.toLowerCase().startsWith('bearer ')) return alt;
  return null;
}

export async function requireUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Unauthorized');
  const supabase = getRlsSupabase(token);
  const res = await supabase.auth.getUser();
  const user = res.data?.user;
  if (!user) throw new Error('Unauthorized');
  const ip = getClientIp(req) || 'unknown';
  if (await isRequestBanned({ ip, identityId: user.id })) throw new Error('Banned');
  return user;
}

export async function getEffectiveProfileByToken(token: string) {
  const supabase = getRlsSupabase(token);
  const res = await supabase.auth.getUser();
  const user = res.data?.user;
  if (!user) throw new Error('Unauthorized');

  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<EffectiveProfile>();
  if (error) throw error;

  const effectiveProfile: EffectiveProfile = {
    ...(profile || {}),
    email: (profile?.email as string | null | undefined) || user.email || null,
    assigned_roles: [],
    login_aliases: [],
  };

  const serviceSupabase = getServerSupabase();

  try {
    const rolesRes = await serviceSupabase
      .from('app_user_roles')
      .select('role_id, app_roles:role_id(id,name,permissions)')
      .eq('user_id', user.id);
    if (rolesRes.error) throw rolesRes.error;

    const assignedRoles: Array<{ id: string; name: string }> = [];
    for (const row of (rolesRes.data || []) as AppRoleJoinRow[]) {
      const roleData = Array.isArray(row.app_roles) ? row.app_roles[0] : row.app_roles;
      const roleId = String(roleData?.id || row.role_id || '').trim();
      const roleName = String(roleData?.name || '').trim();
      if (roleId && roleName) {
        assignedRoles.push({ id: roleId, name: roleName });
      }
      mergeRolePermissions(effectiveProfile, toRecord(roleData?.permissions));
    }
    effectiveProfile.assigned_roles = assignedRoles;
  } catch (error: unknown) {
    if (!isMissingRelation(error, 'app_user_roles')) throw error;
  }

  try {
    const aliasesRes = await serviceSupabase
      .from('user_login_aliases')
      .select('email')
      .eq('user_id', user.id)
      .order('email', { ascending: true });
    if (aliasesRes.error) throw aliasesRes.error;
    effectiveProfile.login_aliases = (aliasesRes.data || [])
      .map((row: LoginAliasRow) => String(row.email || '').trim().toLowerCase())
      .filter(Boolean);
  } catch (error: unknown) {
    if (!isMissingRelation(error, 'user_login_aliases')) throw error;
  }

  effectiveProfile.has_admin_access = !!(effectiveProfile.is_admin || effectiveProfile.can_manage_admins);
  effectiveProfile.has_member_access = !!(
    effectiveProfile.is_member ||
    effectiveProfile.is_admin ||
    effectiveProfile.can_manage_admins ||
    effectiveProfile.can_view_member_portal ||
    effectiveProfile.can_edit_member_portal
  );

  return { user, profile: effectiveProfile, supabase };
}

export async function requireAdmin(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Unauthorized');
  const user = await requireUser(req);
  const { profile } = await getEffectiveProfileByToken(token);
  if (!profile?.has_admin_access) throw new Error('Forbidden');
  return { user, profile: profile as AdminProfileRow & EffectiveProfile };
}

export async function requireSuperadmin(req: Request) {
  const { user, profile } = await requireAdmin(req);
  if (!profile?.can_manage_admins) throw new Error('Forbidden');
  return { user, profile };
}

export async function requireMember(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Unauthorized');
  const user = await requireUser(req);
  const { profile } = await getEffectiveProfileByToken(token);
  if (!profile?.has_member_access) throw new Error('Forbidden');
  return { user, profile: profile as MemberProfileRow & EffectiveProfile };
}

export async function requireTrustBoxAdmin(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Unauthorized');
  const supabase = getRlsSupabase(token);
  const user = await requireUser(req);
  const profRes = await supabase.from('profiles').select('can_manage_admins').eq('id', user.id).maybeSingle<AdminProfileRow>();
  if (profRes.error) throw profRes.error;
  const isSuperadmin = !!profRes.data?.can_manage_admins;
  if (isSuperadmin) return { user, isSuperadmin: true, canViewPii: true };

  const row = await supabase.from('trust_box_admins').select('can_view_pii').eq('user_id', user.id).maybeSingle<TrustBoxAdminRow>();
  if (row.error) throw row.error;
  if (!row.data) throw new Error('Forbidden');
  return { user, isSuperadmin: false, canViewPii: !!row.data.can_view_pii };
}
