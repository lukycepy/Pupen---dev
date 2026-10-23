import { getServerSupabase } from '@/lib/supabase-server';

interface ProfileRow {
  id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_member?: boolean | null;
  is_admin?: boolean | null;
  member_since?: string | null;
  member_expires_at?: string | null;
  member_no?: number | null;
  marketing_consent?: boolean | null;
}

interface UserRoleRow {
  role_id?: string | null;
  assigned_at?: string | null;
  assigned_by_email?: string | null;
  app_roles?: {
    name?: string | null;
    permissions?: Record<string, unknown> | null;
  } | null;
}

interface ApplicationRow {
  id?: string | null;
  status?: string | null;
  user_id?: string | null;
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Error');
}

function isImmutableMembershipApplicationError(error: unknown) {
  return /membership application is immutable/i.test(getErrorMessage(error));
}

function pickTargetProfilePatch(source: ProfileRow | null, target: ProfileRow | null) {
  const patch: Record<string, unknown> = {};
  if (!source || !target) return patch;
  if (!target.first_name && source.first_name) patch.first_name = source.first_name;
  if (!target.last_name && source.last_name) patch.last_name = source.last_name;
  if (!target.email && source.email) patch.email = source.email;
  if (target.is_member !== true && source.is_member === true) patch.is_member = true;
  if (!target.member_since && source.member_since) patch.member_since = source.member_since;
  if (!target.member_expires_at && source.member_expires_at) patch.member_expires_at = source.member_expires_at;
  if (target.marketing_consent !== true && source.marketing_consent === true) patch.marketing_consent = true;
  return patch;
}

export interface MembershipMergePreview {
  ok: true;
  sourceProfile: ProfileRow | null;
  targetProfile: ProfileRow | null;
  membershipRolesToMove: Array<{ roleId: string; roleName: string }>;
  membershipRolesAlreadyOnTarget: Array<{ roleId: string; roleName: string }>;
  applicationsToRelink: Array<{ id: string; status: string | null }>;
  targetProfilePatchPreview: Record<string, unknown>;
  sourceHasMemberNo: boolean;
  targetHasMemberNo: boolean;
}

export async function getMembershipMergePreview(input: {
  supabase: ReturnType<typeof getServerSupabase>;
  sourceProfileId: string;
  targetProfileId: string;
}) : Promise<MembershipMergePreview> {
  const { supabase, sourceProfileId, targetProfileId } = input;
  if (!sourceProfileId || !targetProfileId || sourceProfileId === targetProfileId) {
    throw new Error('Invalid merge pair');
  }

  const [sourceRes, targetRes, sourceRolesRes, targetRolesRes, appsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,email,first_name,last_name,is_member,is_admin,member_since,member_expires_at,member_no,marketing_consent')
      .eq('id', sourceProfileId)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('profiles')
      .select('id,email,first_name,last_name,is_member,is_admin,member_since,member_expires_at,member_no,marketing_consent')
      .eq('id', targetProfileId)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('app_user_roles')
      .select('role_id,assigned_at,assigned_by_email,app_roles:role_id(name,permissions)')
      .eq('user_id', sourceProfileId),
    supabase
      .from('app_user_roles')
      .select('role_id,assigned_at,assigned_by_email,app_roles:role_id(name,permissions)')
      .eq('user_id', targetProfileId),
    supabase
      .from('membership_applications_v2')
      .select('id,status,user_id')
      .eq('user_id', sourceProfileId)
      .order('created_at', { ascending: false }),
  ]);

  if (sourceRes.error) throw sourceRes.error;
  if (targetRes.error) throw targetRes.error;
  if (sourceRolesRes.error) throw sourceRolesRes.error;
  if (targetRolesRes.error) throw targetRolesRes.error;
  if (appsRes.error) throw appsRes.error;

  const sourceProfile = sourceRes.data || null;
  const targetProfile = targetRes.data || null;
  const sourceRoles = Array.isArray(sourceRolesRes.data) ? (sourceRolesRes.data as UserRoleRow[]) : [];
  const targetRoles = Array.isArray(targetRolesRes.data) ? (targetRolesRes.data as UserRoleRow[]) : [];
  const applications = Array.isArray(appsRes.data) ? (appsRes.data as ApplicationRow[]) : [];

  const targetRoleIds = new Set(targetRoles.map((row) => String(row.role_id || '')).filter(Boolean));
  const membershipRoles = sourceRoles.filter((row) => {
    const permissions = toRecord(row.app_roles?.permissions);
    return permissions.is_member === true || permissions.can_view_member_portal === true;
  });

  return {
    ok: true,
    sourceProfile,
    targetProfile,
    membershipRolesToMove: membershipRoles
      .filter((row) => !targetRoleIds.has(String(row.role_id || '')))
      .map((row) => ({
        roleId: String(row.role_id || ''),
        roleName: String(row.app_roles?.name || row.role_id || ''),
      })),
    membershipRolesAlreadyOnTarget: membershipRoles
      .filter((row) => targetRoleIds.has(String(row.role_id || '')))
      .map((row) => ({
        roleId: String(row.role_id || ''),
        roleName: String(row.app_roles?.name || row.role_id || ''),
      })),
    applicationsToRelink: applications.map((row) => ({
      id: String(row.id || ''),
      status: row.status ? String(row.status) : null,
    })),
    targetProfilePatchPreview: pickTargetProfilePatch(sourceProfile, targetProfile),
    sourceHasMemberNo: typeof sourceProfile?.member_no === 'number',
    targetHasMemberNo: typeof targetProfile?.member_no === 'number',
  };
}

export interface MembershipMergeApplyResult {
  ok: true;
  rolesInserted: number;
  rolesRemovedFromSource: number;
  applicationsRelinked: number;
  applicationsBlockedByDbGuard: boolean;
  targetProfilePatched: boolean;
  warnings: string[];
}

export async function applyMembershipMergePrep(input: {
  supabase: ReturnType<typeof getServerSupabase>;
  sourceProfileId: string;
  targetProfileId: string;
  actorEmail: string | null;
}) : Promise<MembershipMergeApplyResult> {
  const { supabase, sourceProfileId, targetProfileId, actorEmail } = input;
  const preview = await getMembershipMergePreview({ supabase, sourceProfileId, targetProfileId });
  const warnings: string[] = [];

  if (!preview.sourceProfile?.id || !preview.targetProfile?.id) {
    throw new Error('Missing source or target profile');
  }

  let rolesInserted = 0;
  let rolesRemovedFromSource = 0;
  let applicationsRelinked = 0;
  let applicationsBlockedByDbGuard = false;
  let targetProfilePatched = false;

  if (preview.membershipRolesToMove.length) {
    const nowIso = new Date().toISOString();
    const ins = await supabase.from('app_user_roles').upsert(
      preview.membershipRolesToMove.map((role) => ({
        user_id: targetProfileId,
        role_id: role.roleId,
        assigned_at: nowIso,
        assigned_by_email: actorEmail,
      })),
      { onConflict: 'user_id,role_id' },
    );
    if (ins.error) throw ins.error;
    rolesInserted = preview.membershipRolesToMove.length;
  }

  const membershipRoleIds = [
    ...preview.membershipRolesToMove.map((row) => row.roleId),
    ...preview.membershipRolesAlreadyOnTarget.map((row) => row.roleId),
  ].filter(Boolean);
  if (membershipRoleIds.length) {
    const del = await supabase.from('app_user_roles').delete().eq('user_id', sourceProfileId).in('role_id', membershipRoleIds);
    if (del.error) throw del.error;
    rolesRemovedFromSource = membershipRoleIds.length;
  }

  if (preview.applicationsToRelink.length) {
    const up = await supabase.from('membership_applications_v2').update({ user_id: targetProfileId }).eq('user_id', sourceProfileId);
    if (up.error) {
      if (isImmutableMembershipApplicationError(up.error)) {
        applicationsBlockedByDbGuard = true;
        warnings.push('membership_applications_v2 update blocked by immutable DB guard; run latest migration');
      } else {
        throw up.error;
      }
    } else {
      applicationsRelinked = preview.applicationsToRelink.length;
    }
  }

  const profilePatch = pickTargetProfilePatch(preview.sourceProfile, preview.targetProfile);
  if (Object.keys(profilePatch).length) {
    const up = await supabase.from('profiles').update(profilePatch).eq('id', targetProfileId);
    if (up.error) throw up.error;
    targetProfilePatched = true;
  }

  if (preview.sourceHasMemberNo && !preview.targetHasMemberNo) {
    warnings.push('source profile keeps member_no; transfer was skipped to stay non-destructive');
  }

  return {
    ok: true,
    rolesInserted,
    rolesRemovedFromSource,
    applicationsRelinked,
    applicationsBlockedByDbGuard,
    targetProfilePatched,
    warnings,
  };
}
