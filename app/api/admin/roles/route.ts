import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes("Could not find the table") && msg.includes("in the schema cache");
}

const ALLOWED_PROFILE_FIELDS = new Set([
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

function pickPermissions(input: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(input || {})) {
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
    const roles = await supabase.from('app_roles').select('id,name,permissions,color_hex,updated_at,created_at').order('name', { ascending: true });
    if (roles.error) throw roles.error;

    const assignmentsRes = await supabase
      .from('app_user_roles')
      .select('user_id, role_id, assigned_at, assigned_by_email')
      .order('assigned_at', { ascending: false });
    if (assignmentsRes.error) throw assignmentsRes.error;
    const assignments = (assignmentsRes.data || []) as any[];

    const userIds = Array.from(new Set(assignments.map((a) => String(a.user_id)).filter(Boolean)));
    let profilesById: Record<string, any> = {};
    if (userIds.length) {
      const profRes = await supabase.from('profiles').select('id,email,first_name,last_name').in('id', userIds);
      if (profRes.error) throw profRes.error;
      profilesById = Object.fromEntries((profRes.data || []).map((p: any) => [String(p.id), p]));
    }
    const assignmentsWithProfiles = assignments.map((a) => ({ ...a, profiles: profilesById[String(a.user_id)] || null }));

    return NextResponse.json({
      ok: true,
      roles: roles.data || [],
      assignments: assignmentsWithProfiles,
      permissionKeys: Array.from(ALLOWED_PROFILE_FIELDS),
    });
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) {
      return NextResponse.json(
        {
          error:
            "Role nejsou v DB vytvořené. Spusť migraci `supabase/migrations/26_app_roles.sql` v Supabase (SQL editor / migrations) a případně restartuj API, aby se obnovil schema cache.",
        },
        { status: 501 },
      );
    }
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const body = await req.json().catch(() => ({}));
    const roleId = body?.id ? String(body.id) : null;
    const name = String(body?.name || '').trim();
    const colorHex = String(body?.color_hex || body?.colorHex || '').trim() || '#16a34a';
    const permissions = pickPermissions(body?.permissions || {});
    if (!name || name.length < 2) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date().toISOString();
    const up = roleId
      ? await supabase
          .from('app_roles')
          .update({ name, permissions, color_hex: colorHex, updated_at: now })
          .eq('id', roleId)
          .select('id,name,permissions,color_hex,updated_at,created_at')
          .single()
      : await supabase
          .from('app_roles')
          .insert([{ name, permissions, color_hex: colorHex, updated_at: now }])
          .select('id,name,permissions,color_hex,updated_at,created_at')
          .single();
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
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) {
      return NextResponse.json(
        {
          error:
            "Role nejsou v DB vytvořené. Spusť migraci `supabase/migrations/26_app_roles.sql` v Supabase (SQL editor / migrations) a případně restartuj API, aby se obnovil schema cache.",
        },
        { status: 501 },
      );
    }
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
