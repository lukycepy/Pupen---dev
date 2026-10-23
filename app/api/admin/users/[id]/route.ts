import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { PROFILE_PERMISSION_KEYS_SET } from '@/lib/rbac/registry';

type JsonRecord = Record<string, unknown>;

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

const ALLOWED_PROFILE_FIELDS = new Set([
  'first_name',
  'last_name',
  'email',
  'member_since',
  'member_expires_at',
  'member_expiry_notice_stage',
  'member_expiry_notice_at',
  'is_blocked',
  'blocked_at',
  'blocked_reason',
  ...PROFILE_PERMISSION_KEYS_SET,
]);

function pickProfilePatch(input: unknown) {
  const out: JsonRecord = {};
  const record = toRecord(input);
  for (const [k, v] of Object.entries(record)) {
    if (!ALLOWED_PROFILE_FIELDS.has(k)) continue;
    out[k] = v;
  }
  if ('is_admin' in out) out.is_admin = !!out.is_admin;
  if ('is_member' in out) out.is_member = !!out.is_member;
  if ('can_manage_admins' in out) out.can_manage_admins = !!out.can_manage_admins;
  if ('is_blocked' in out) out.is_blocked = !!out.is_blocked;
  for (const k of Object.keys(out)) {
    if (k.startsWith('can_view_') || k.startsWith('can_edit_')) out[k] = !!out[k];
  }
  if ('member_since' in out && !out.member_since) out.member_since = null;
  if ('member_expires_at' in out && !out.member_expires_at) out.member_expires_at = null;
  if ('member_expiry_notice_stage' in out && !out.member_expiry_notice_stage) out.member_expiry_notice_stage = null;
  if ('member_expiry_notice_at' in out && !out.member_expiry_notice_at) out.member_expiry_notice_at = null;
  if ('blocked_at' in out && !out.blocked_at) out.blocked_at = null;
  if ('blocked_reason' in out && !out.blocked_reason) out.blocked_reason = null;
  return out;
}

function uniqueAliases(input: unknown, primaryEmail: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  const primary = normalizeEmail(primaryEmail);
  for (const raw of Array.isArray(input) ? input : []) {
    const email = normalizeEmail(raw);
    if (!email || !email.includes('@') || email === primary || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out.slice(0, 20);
}

async function syncLoginAliases(
  supabase: ReturnType<typeof getServerSupabase>,
  userId: string,
  primaryEmail: string,
  aliasesInput: unknown,
  createdBy: string | null,
) {
  const aliases = uniqueAliases(aliasesInput, primaryEmail);
  const existingRes = await supabase
    .from('user_login_aliases')
    .select('id,email,normalized_email')
    .eq('user_id', userId);
  if (existingRes.error) throw existingRes.error;

  const existing = existingRes.data || [];
  const existingByNormalized = new Map(existing.map((row: any) => [String(row.normalized_email || '').trim().toLowerCase(), row]));
  const nextSet = new Set(aliases);

  const toDelete = existing
    .filter((row: any) => !nextSet.has(String(row.normalized_email || '').trim().toLowerCase()))
    .map((row: any) => String(row.id || '').trim())
    .filter(Boolean);
  if (toDelete.length > 0) {
    const del = await supabase.from('user_login_aliases').delete().in('id', toDelete);
    if (del.error) throw del.error;
  }

  const toInsert = aliases
    .filter((email) => !existingByNormalized.has(email))
    .map((email) => ({
      user_id: userId,
      email,
      normalized_email: email,
      created_by: createdBy,
    }));
  if (toInsert.length > 0) {
    const ins = await supabase.from('user_login_aliases').insert(toInsert);
    if (ins.error) throw ins.error;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile } = await requireAdmin(req);
    if (!adminProfile?.can_manage_admins) throw new Error('Forbidden');
    const { id } = await ctx.params;
    const supabase = getServerSupabase();

    const [profileRes, aliasesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('user_login_aliases').select('email').eq('user_id', id).order('email', { ascending: true }),
      supabase
        .from('app_user_roles')
        .select('role_id, assigned_at, assigned_by_email, app_roles:role_id(id,name,color_hex,permissions)')
        .eq('user_id', id)
        .order('assigned_at', { ascending: false }),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (aliasesRes.error) throw aliasesRes.error;
    if (rolesRes.error) throw rolesRes.error;

    return NextResponse.json({
      ok: true,
      profile: profileRes.data || null,
      loginAliases: (aliasesRes.data || []).map((row: any) => String(row.email || '').trim().toLowerCase()).filter(Boolean),
      roleAssignments: rolesRes.data || [],
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user: adminUser, profile: adminProfile } = await requireAdmin(req);
    if (!adminProfile?.can_manage_admins) throw new Error('Forbidden');
    const { id } = await ctx.params;
    const supabase = getServerSupabase();

    const body = toRecord(await req.json().catch(() => ({})));
    const profilePatch = pickProfilePatch(body);
    const password = typeof body.password === 'string' ? body.password : '';
    const aliasesInput = body.login_aliases;

    if (password) {
      const email = profilePatch.email ? String(profilePatch.email) : body.email ? String(body.email) : '';
      const pw = evaluatePassword(password, { email });
      if (!pw.ok) return NextResponse.json({ error: 'Password does not meet policy' }, { status: 400 });
      const upd = await supabase.auth.admin.updateUserById(id, { password });
      if (upd.error) throw upd.error;
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabase.from('profiles').update(profilePatch).eq('id', id);
      if (error) throw error;
    }

    if (aliasesInput !== undefined) {
      const currentProfile = await supabase.from('profiles').select('email').eq('id', id).maybeSingle<{ email?: string | null }>();
      if (currentProfile.error) throw currentProfile.error;
      const primaryEmail = normalizeEmail(profilePatch.email) || normalizeEmail(body.email) || normalizeEmail(currentProfile.data?.email);
      await syncLoginAliases(supabase, id, primaryEmail, aliasesInput, adminUser.id || null);
    }

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: adminUser.email || 'admin',
          admin_name: 'Uživatelé',
          action: 'USER_UPDATE',
          target_id: id,
          details: {
            patch: Object.keys(profilePatch),
            password_changed: !!password,
            alias_count: aliasesInput === undefined ? undefined : uniqueAliases(aliasesInput, String(profilePatch.email || body.email || '')).length,
          },
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user: adminUser, profile: adminProfile } = await requireAdmin(req);
    if (!adminProfile?.can_manage_admins) throw new Error('Forbidden');
    const { id } = await ctx.params;
    const supabase = getServerSupabase();

    const delAuth = await supabase.auth.admin.deleteUser(id);
    if (delAuth.error) throw delAuth.error;

    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch {}

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: adminUser.email || 'admin',
          admin_name: 'Uživatelé',
          action: 'USER_DELETE',
          target_id: id,
          details: {},
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
