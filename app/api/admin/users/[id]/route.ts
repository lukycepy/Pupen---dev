import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { PROFILE_PERMISSION_KEYS_SET } from '@/lib/rbac/registry';

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

function pickProfilePatch(input: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(input || {})) {
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user: adminUser, profile: adminProfile } = await requireAdmin(req);
    if (!adminProfile?.can_manage_admins) throw new Error('Forbidden');
    const { id } = await ctx.params;
    const supabase = getServerSupabase();

    const body = await req.json().catch(() => ({}));
    const profilePatch = pickProfilePatch(body);
    const password = typeof body?.password === 'string' ? body.password : '';

    if (password) {
      const email = profilePatch.email ? String(profilePatch.email) : body?.email ? String(body.email) : '';
      const pw = evaluatePassword(password, { email });
      if (!pw.ok) return NextResponse.json({ error: 'Password does not meet policy' }, { status: 400 });
      const upd = await supabase.auth.admin.updateUserById(id, { password });
      if (upd.error) throw upd.error;
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabase.from('profiles').update(profilePatch).eq('id', id);
      if (error) throw error;
    }

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: adminUser.email || 'admin',
          admin_name: 'Uživatelé',
          action: 'USER_UPDATE',
          target_id: id,
          details: { patch: Object.keys(profilePatch), password_changed: !!password },
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
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
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
