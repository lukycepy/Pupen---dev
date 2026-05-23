import { NextResponse } from 'next/server';
import { requireAdmin, requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { PageBlocksSchema, pageBlocksToHtml } from '@/lib/site/page-blocks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function canAccessSitePage(opts: {
  supabase: any;
  userId: string;
  slug: string;
  action: 'view' | 'edit';
}) {
  const { supabase, userId, slug, action } = opts;

  const profRes = await supabase
    .from('profiles')
    .select('can_manage_admins, can_view_site_pages, can_edit_site_pages')
    .eq('id', userId)
    .maybeSingle();
  if (profRes.error) throw profRes.error;
  const profile: any = profRes.data || {};

  if (profile?.can_manage_admins) return true;

  const globalView = !!profile?.can_view_site_pages || !!profile?.can_edit_site_pages;
  const globalEdit = !!profile?.can_edit_site_pages;

  if (action === 'view' && globalView) return true;
  if (action === 'edit' && globalEdit) return true;

  const rolesRes = await supabase.from('app_user_roles').select('role_id').eq('user_id', userId);
  if (rolesRes.error) throw rolesRes.error;
  const roleIds = Array.isArray(rolesRes.data) ? rolesRes.data.map((r: any) => String(r?.role_id || '').trim()).filter(Boolean) : [];

  const rows: any[] = [];

  const userPerms = await supabase.from('site_page_permissions').select('can_view,can_edit').eq('page_slug', slug).eq('user_id', userId);
  if (userPerms.error) throw userPerms.error;
  rows.push(...(userPerms.data || []));

  if (roleIds.length) {
    const rolePerms = await supabase.from('site_page_permissions').select('can_view,can_edit').eq('page_slug', slug).in('role_id', roleIds);
    if (rolePerms.error) throw rolePerms.error;
    rows.push(...(rolePerms.data || []));
  }

  if (action === 'edit') return rows.some((r) => r?.can_edit === true);
  return rows.some((r) => r?.can_view === true || r?.can_edit === true);
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin(req);
    const { slug } = await params;
    const s = String(slug || '').trim();
    if (!s) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const supabase = getServerSupabase();
    const user = await requireUser(req);
    if (!(await canAccessSitePage({ supabase, userId: user.id, slug: s, action: 'view' }))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const res = await supabase
      .from('site_page_contents')
      .select('slug,lang,title,content_html,content_blocks,updated_at')
      .eq('slug', s);
    if (res.error) throw res.error;
    const rows = res.data || [];
    const out = NextResponse.json({ ok: true, items: rows });
    out.headers.set('Cache-Control', 'no-store');
    return out;
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin(req);
    const { slug } = await params;
    const s = String(slug || '').trim();
    if (!s) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const cs = body?.cs && typeof body.cs === 'object' ? body.cs : {};
    const en = body?.en && typeof body.en === 'object' ? body.en : {};

    const normalizeContent = (obj: any) => {
      const title = Object.prototype.hasOwnProperty.call(obj || {}, 'title') ? obj.title ?? null : undefined;
      const hasHtml = Object.prototype.hasOwnProperty.call(obj || {}, 'content_html');
      const hasBlocks = Object.prototype.hasOwnProperty.call(obj || {}, 'content_blocks');
      const html = hasHtml ? (obj?.content_html ?? null) : undefined;
      let blocks: any = hasBlocks ? (obj?.content_blocks ?? null) : undefined;
      if (blocks !== undefined && blocks !== null) {
        const parsed = PageBlocksSchema.safeParse(blocks);
        if (!parsed.success) throw new Error('Neplatné content_blocks');
        blocks = parsed.data;
      }
      if (blocks !== undefined) {
        if (blocks && html === undefined) {
          return { title, content_blocks: blocks, content_html: pageBlocksToHtml(blocks) };
        }
        return { title, content_blocks: blocks, content_html: html };
      }
      if (html !== undefined) {
        return { title, content_blocks: null, content_html: html };
      }
      return { title };
    };

    const nextCs = normalizeContent(cs);
    const nextEn = normalizeContent(en);

    const supabase = getServerSupabase();
    const user = await requireUser(req);
    if (!(await canAccessSitePage({ supabase, userId: user.id, slug: s, action: 'edit' }))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const now = new Date().toISOString();

    const upserts = [
      { slug: s, lang: 'cs', title: (nextCs as any).title ?? null, content_html: (nextCs as any).content_html ?? null, content_blocks: (nextCs as any).content_blocks ?? null, updated_at: now },
      { slug: s, lang: 'en', title: (nextEn as any).title ?? null, content_html: (nextEn as any).content_html ?? null, content_blocks: (nextEn as any).content_blocks ?? null, updated_at: now },
    ];

    const res = await supabase.from('site_page_contents').upsert(upserts, { onConflict: 'slug,lang' }).select('slug,lang,title,content_html,content_blocks,updated_at');
    if (res.error) throw res.error;

    const out = NextResponse.json({ ok: true, items: res.data || [] });
    out.headers.set('Cache-Control', 'no-store');
    return out;
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
