import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

const ALLOWED_PROFILE_FIELDS = new Set([
  'first_name',
  'last_name',
  'email',
  'is_admin',
  'is_member',
  'member_since',
  'can_manage_admins',
  'can_view_events',
  'can_edit_events',
  'can_view_news',
  'can_edit_news',
  'can_view_faq',
  'can_edit_faq',
  'can_view_partners',
  'can_edit_partners',
  'can_view_apps',
  'can_edit_apps',
  'can_view_documents',
  'can_edit_documents',
  'can_view_gallery',
  'can_edit_gallery',
  'can_view_map',
  'can_edit_map',
  'can_view_hunts',
  'can_edit_hunts',
  'can_view_budget',
  'can_edit_budget',
  'can_view_logs',
  'can_edit_logs',
  'can_view_messages',
  'can_edit_messages',
  'can_view_meetings',
  'can_edit_meetings',
  'can_view_polls',
  'can_edit_polls',
  'can_view_quizzes',
  'can_edit_quizzes',
  'can_view_jobs',
  'can_edit_jobs',
  'can_view_schedule',
  'can_edit_schedule',
  'can_view_guide',
  'can_edit_guide',
  'can_view_hours',
  'can_edit_hours',
  'can_view_discounts',
  'can_edit_discounts',
  'can_view_feedback',
  'can_edit_feedback',
  'can_view_qr',
  'can_edit_qr',
  'can_view_assets',
  'can_edit_assets',
  'can_view_archive',
  'can_edit_archive',
  'can_view_books',
  'can_edit_books',
  'can_view_blog_mod',
  'can_edit_blog_mod',
  'can_view_reviews',
  'can_edit_reviews',
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
  for (const k of Object.keys(out)) {
    if (k.startsWith('can_view_') || k.startsWith('can_edit_')) out[k] = !!out[k];
  }
  if ('member_since' in out && !out.member_since) out.member_since = null;
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
