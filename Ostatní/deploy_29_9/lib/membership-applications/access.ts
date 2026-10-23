import { getServerSupabase } from '@/lib/supabase-server';

type JsonRecord = Record<string, unknown>;

interface AuthUserListRow {
  id?: string | null;
  email?: string | null;
}

interface GenerateLinkData {
  user?: { id?: string | null } | null;
  properties?: { action_link?: string | null } | null;
}

interface RoleRow {
  id?: string | number | null;
  name?: string | null;
  permissions?: JsonRecord | null;
}

interface ProfileMemberRow {
  member_since?: string | null;
  member_expires_at?: string | null;
}

interface AssignMemberNoResponse {
  data: number | string | null;
  error: Error | null;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function isMissingColumnError(message: string, feature: string) {
  return new RegExp(feature, 'i').test(message) && /(schema cache|does not exist|column|relation)/i.test(message);
}

export async function findUserIdByEmail(supabase: ReturnType<typeof getServerSupabase>, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const users: AuthUserListRow[] = Array.isArray(res.data?.users) ? res.data.users : [];
    const match = users.find((row) => String(row.email || '').trim().toLowerCase() === email.toLowerCase());
    if (match?.id) return String(match.id);
    if (users.length < perPage) return null;
  }
  return null;
}

export function pickProfilePatch(perms: unknown) {
  const out: JsonRecord = {};
  const record = toRecord(perms);
  for (const [k, v] of Object.entries(record)) {
    const key = String(k);
    if (key === 'is_admin' || key === 'is_member' || key === 'can_manage_admins' || key.startsWith('can_view_') || key.startsWith('can_edit_')) {
      out[key] = !!v;
    }
  }
  return out;
}

export async function ensureMemberRole(supabase: ReturnType<typeof getServerSupabase>) {
  const res = await supabase.from('app_roles').select('id,name,permissions').eq('name', 'ČLEN').maybeSingle<RoleRow>();
  if (!res.error && res.data?.id) return res.data;

  const created = await supabase
    .from('app_roles')
    .insert([
      {
        name: 'ČLEN',
        color_hex: '#2563eb',
        permissions: { is_member: true, can_view_member_portal: true },
        updated_at: new Date().toISOString(),
      },
    ])
    .select('id,name,permissions')
    .single<RoleRow>();
  if (created.error) throw created.error;
  return created.data;
}

export interface EnsureMembershipAccessInput {
  supabase: ReturnType<typeof getServerSupabase>;
  applicationId: string;
  applicantEmail: string;
  lang: 'cs' | 'en';
  firstName: string;
  lastName: string;
  decidedAt: string;
  actorEmail: string | null;
  marketingConsent?: boolean;
  existingUserId?: string | null;
  siteUrl: string;
}

export interface EnsureMembershipAccessResult {
  userId: string;
  roleId: string | null;
  roleName: string | null;
  memberNo: number | null;
  actionUrlPublic: string;
}

export async function ensureMembershipApplicationAccessProvisioned(
  input: EnsureMembershipAccessInput,
): Promise<EnsureMembershipAccessResult> {
  const {
    supabase,
    applicationId,
    applicantEmail,
    lang,
    firstName,
    lastName,
    decidedAt,
    actorEmail,
    marketingConsent = false,
    existingUserId,
    siteUrl,
  } = input;

  const redirectTo = `${siteUrl.replace(/\/$/, '')}/${lang}/reset-password`;
  const role = await ensureMemberRole(supabase);
  const rolePerms = toRecord(role?.permissions);
  const profilePatch = pickProfilePatch(rolePerms);

  const resolvedExistingUserId = String(existingUserId || '').trim() || (await findUserIdByEmail(supabase, applicantEmail)) || '';
  let userId = resolvedExistingUserId;
  let actionUrl = '';

  if (!userId) {
    const invite = await supabase.auth.admin.generateLink({ type: 'invite', email: applicantEmail, options: { redirectTo } });
    if (invite.error) throw invite.error;
    const inviteData = invite.data as GenerateLinkData | null;
    userId = String(inviteData?.user?.id || '');
    actionUrl = String(inviteData?.properties?.action_link || '');
  } else {
    const recovery = await supabase.auth.admin.generateLink({ type: 'recovery', email: applicantEmail, options: { redirectTo } });
    if (recovery.error) throw recovery.error;
    const recoveryData = recovery.data as GenerateLinkData | null;
    actionUrl = String(recoveryData?.properties?.action_link || '');
  }

  if (!userId) throw new Error('Chybí userId');
  if (!actionUrl) throw new Error('Chybí aktivační odkaz');

  await supabase
    .from('app_user_roles')
    .upsert(
      [
        {
          user_id: userId,
          role_id: String(role.id),
          assigned_at: new Date().toISOString(),
          assigned_by_email: actorEmail,
        },
      ],
      { onConflict: 'user_id,role_id' },
    )
    .throwOnError();

  let profileUp = await supabase
    .from('profiles')
    .update({
      email: applicantEmail,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      ...(Object.keys(profilePatch).length ? profilePatch : {}),
      ...(marketingConsent ? { marketing_consent: true, marketing_consent_at: decidedAt } : {}),
    })
    .eq('id', userId);
  if (profileUp.error && isMissingColumnError(profileUp.error.message, 'marketing_consent_at')) {
    profileUp = await supabase
      .from('profiles')
      .update({
        email: applicantEmail,
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
        ...(Object.keys(profilePatch).length ? profilePatch : {}),
        ...(marketingConsent ? { marketing_consent: true } : {}),
      })
      .eq('id', userId);
  }
  if (profileUp.error) throw profileUp.error;

  const appUserUp = await supabase.from('membership_applications_v2').update({ user_id: userId }).eq('id', applicationId);
  if (appUserUp.error && !isMissingColumnError(appUserUp.error.message, 'user_id')) throw appUserUp.error;

  try {
    const prof = await supabase.from('profiles').select('member_since, member_expires_at').eq('id', userId).maybeSingle<ProfileMemberRow>();
    const current: ProfileMemberRow = prof.data || {};
    const updates: Record<string, string> = {};
    if (!current.member_since) updates.member_since = decidedAt;
    if (!current.member_expires_at) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      updates.member_expires_at = d.toISOString();
    }
    if (Object.keys(updates).length) {
      await supabase.from('profiles').update(updates).eq('id', userId);
    }
  } catch {}

  let memberNo: number | null = null;
  try {
    const m = (await supabase.rpc('assign_member_no', { p_user_id: userId })) as AssignMemberNoResponse;
    if (!m.error) {
      const raw = typeof m.data === 'number' ? m.data : Number(m.data);
      memberNo = Number.isFinite(raw) ? raw : null;
    }
  } catch {}

  return {
    userId,
    roleId: role?.id != null ? String(role.id) : null,
    roleName: role?.name != null ? String(role.name) : null,
    memberNo,
    actionUrlPublic: `${siteUrl.replace(/\/$/, '')}/api/auth/verify?u=${encodeURIComponent(actionUrl)}`,
  };
}
