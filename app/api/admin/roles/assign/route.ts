import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes("Could not find the table") && msg.includes("in the schema cache");
}

const PROFILE_BOOL_FIELDS = new Set([
  'is_admin',
  'is_member',
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
  'can_view_analytics',
  'can_edit_analytics',
  'can_view_member_portal',
  'can_edit_member_portal',
]);

function pickProfilePatch(perms: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(perms || {})) {
    if (!PROFILE_BOOL_FIELDS.has(k)) continue;
    out[k] = !!v;
  }
  return out;
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
      await supabase
        .from('admin_logs')
        .insert([
          {
            admin_email: user.email || 'admin',
            admin_name: user.user_metadata?.full_name || user.email || 'admin',
            action: 'ROLE_UNASSIGN',
            target_id: userId,
            details: { email: email || null, role_id: roleId },
          },
        ])
        .throwOnError();
      return NextResponse.json({ ok: true });
    }

    if (!roleId) {
      await supabase.from('app_user_roles').delete().eq('user_id', userId).throwOnError();
      await supabase
        .from('admin_logs')
        .insert([
          {
            admin_email: user.email || 'admin',
            admin_name: user.user_metadata?.full_name || user.email || 'admin',
            action: 'ROLE_CLEAR',
            target_id: userId,
            details: email ? { email } : {},
          },
        ])
        .throwOnError();
      return NextResponse.json({ ok: true });
    }

    const roleRes = await supabase.from('app_roles').select('id,name,permissions').eq('id', roleId).single();
    if (roleRes.error) throw roleRes.error;
    const role: any = roleRes.data;
    const patch = pickProfilePatch(role?.permissions || {});

    await supabase
      .from('app_user_roles')
      .upsert(
        [{ user_id: userId, role_id: roleId, assigned_at: new Date().toISOString(), assigned_by_email: user.email || null }],
        { onConflict: 'user_id,role_id' },
      )
      .throwOnError();

    if (Object.keys(patch).length > 0) {
      await supabase.from('profiles').update(patch).eq('id', userId).throwOnError();
    }

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'ROLE_ASSIGN',
          target_id: userId,
          details: { email: email || null, role_id: roleId, role_name: role?.name || null, permissionKeys: Object.keys(patch) },
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
