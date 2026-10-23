import { NextResponse } from 'next/server';
import { requireAdmin, requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { CMS_PAGES } from '@/lib/site/cms-pages-registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SitePagesProfileRow {
  can_manage_admins?: boolean | null;
  can_view_site_pages?: boolean | null;
  can_edit_site_pages?: boolean | null;
}

interface UserRoleRow {
  role_id?: string | null;
}

interface SitePagePermissionRow {
  page_slug?: string | null;
  can_view?: boolean | null;
  can_edit?: boolean | null;
}

function uniq(items: string[]) {
  return Array.from(new Set(items.map((x) => String(x).trim()).filter(Boolean)));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const user = await requireUser(req);
    const supabase = getServerSupabase();

    const profRes = await supabase
      .from('profiles')
      .select('can_manage_admins, can_view_site_pages, can_edit_site_pages')
      .eq('id', user.id)
      .maybeSingle<SitePagesProfileRow>();
    if (profRes.error) throw profRes.error;
    const profile = profRes.data || {};

    const allSlugs = CMS_PAGES.map((p) => p.slug);
    const isSuperadmin = !!profile.can_manage_admins;
    const globalView = !!profile.can_view_site_pages || !!profile.can_edit_site_pages;
    const globalEdit = !!profile.can_edit_site_pages;

    if (isSuperadmin || globalView || globalEdit) {
      return NextResponse.json({
        ok: true,
        any: true,
        allView: true,
        allEdit: isSuperadmin || globalEdit,
        viewSlugs: allSlugs,
        editSlugs: isSuperadmin || globalEdit ? allSlugs : [],
      });
    }

    const roleIdsRes = await supabase.from('app_user_roles').select('role_id').eq('user_id', user.id);
    if (roleIdsRes.error) throw roleIdsRes.error;
    const roleIds = uniq(((roleIdsRes.data || []) as UserRoleRow[]).map((r) => r.role_id || ''));

    const perms: SitePagePermissionRow[] = [];

    const userPerms = await supabase
      .from('site_page_permissions')
      .select('page_slug,can_view,can_edit')
      .eq('user_id', user.id);
    if (userPerms.error) throw userPerms.error;
    perms.push(...((userPerms.data || []) as SitePagePermissionRow[]));

    if (roleIds.length) {
      const rolePerms = await supabase
        .from('site_page_permissions')
        .select('page_slug,can_view,can_edit')
        .in('role_id', roleIds);
      if (rolePerms.error) throw rolePerms.error;
      perms.push(...((rolePerms.data || []) as SitePagePermissionRow[]));
    }

    const view = new Set<string>();
    const edit = new Set<string>();
    for (const p of perms) {
      const slug = String(p?.page_slug || '').trim();
      if (!slug) continue;
      if (p?.can_view === true || p?.can_edit === true) view.add(slug);
      if (p?.can_edit === true) edit.add(slug);
    }

    const viewSlugs = allSlugs.filter((s) => view.has(s));
    const editSlugs = allSlugs.filter((s) => edit.has(s));

    return NextResponse.json({
      ok: true,
      any: viewSlugs.length > 0 || editSlugs.length > 0,
      allView: false,
      allEdit: false,
      viewSlugs,
      editSlugs,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
