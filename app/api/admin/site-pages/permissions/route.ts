import { NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { CMS_PAGES } from '@/lib/site/cms-pages-registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeSlug(input: any) {
  const s = String(input || '').trim();
  if (!s) return '';
  return s;
}

function isKnownSlug(slug: string) {
  return CMS_PAGES.some((p) => p.slug === slug);
}

export async function GET(req: Request) {
  try {
    await requireSuperadmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('site_page_permissions')
      .select('id,page_slug,user_id,role_id,can_view,can_edit,created_at,updated_at,created_by')
      .order('page_slug', { ascending: true })
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;

    const rows = (res.data || []) as any[];
    const userIds = Array.from(new Set(rows.map((r) => String(r.user_id || '')).filter(Boolean)));
    const roleIds = Array.from(new Set(rows.map((r) => String(r.role_id || '')).filter(Boolean)));

    let usersById: Record<string, any> = {};
    if (userIds.length) {
      const u = await supabase.from('profiles').select('id,email,first_name,last_name').in('id', userIds);
      if (u.error) throw u.error;
      usersById = Object.fromEntries((u.data || []).map((x: any) => [String(x.id), x]));
    }

    let rolesById: Record<string, any> = {};
    if (roleIds.length) {
      const r = await supabase.from('app_roles').select('id,name,color_hex').in('id', roleIds);
      if (r.error) throw r.error;
      rolesById = Object.fromEntries((r.data || []).map((x: any) => [String(x.id), x]));
    }

    const items = rows.map((row) => ({
      ...row,
      user: row.user_id ? usersById[String(row.user_id)] || null : null,
      role: row.role_id ? rolesById[String(row.role_id)] || null : null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user: adminUser } = await requireSuperadmin(req);
    const body = await req.json().catch(() => ({}));
    const slug = normalizeSlug(body?.slug);
    const userId = body?.userId ? String(body.userId).trim() : '';
    const roleId = body?.roleId ? String(body.roleId).trim() : '';
    const canView = body?.canView === true || body?.can_view === true;
    const canEdit = body?.canEdit === true || body?.can_edit === true;
    const finalCanView = canView || canEdit;

    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    if (!isKnownSlug(slug)) return NextResponse.json({ error: 'Unknown slug' }, { status: 400 });
    if (!!userId === !!roleId) return NextResponse.json({ error: 'Provide userId or roleId' }, { status: 400 });

    const supabase = getServerSupabase();
    const match: any = { page_slug: slug };
    if (userId) match.user_id = userId;
    if (roleId) match.role_id = roleId;

    if (!finalCanView && !canEdit) {
      const del = await supabase.from('site_page_permissions').delete().match(match);
      if (del.error) throw del.error;
      return NextResponse.json({ ok: true, deleted: true });
    }

    const now = new Date().toISOString();
    const upRes = await supabase
      .from('site_page_permissions')
      .update({ can_view: finalCanView, can_edit: canEdit, updated_at: now })
      .match(match)
      .select('id');
    if (upRes.error) throw upRes.error;

    if (!Array.isArray(upRes.data) || upRes.data.length === 0) {
      const ins = await supabase
        .from('site_page_permissions')
        .insert([
          {
            page_slug: slug,
            user_id: userId || null,
            role_id: roleId || null,
            can_view: finalCanView,
            can_edit: canEdit,
            created_by: adminUser.id,
            updated_at: now,
          },
        ])
        .select('id,page_slug,user_id,role_id,can_view,can_edit,created_at,updated_at,created_by')
        .single();
      if (ins.error) throw ins.error;
      return NextResponse.json({ ok: true, item: ins.data });
    }

    const out = await supabase
      .from('site_page_permissions')
      .select('id,page_slug,user_id,role_id,can_view,can_edit,created_at,updated_at,created_by')
      .match(match)
      .maybeSingle();
    if (out.error) throw out.error;
    return NextResponse.json({ ok: true, item: out.data || null });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
