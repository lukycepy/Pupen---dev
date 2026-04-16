import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

function slugify(input: string) {
  const s = String(input || '')
    .toLowerCase()
    .trim()
    .replaceAll(/[\s_]+/g, '-')
    .replaceAll(/[^a-z0-9-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');
  return s || `policy-${Date.now()}`;
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('governance_policies')
      .select('id, created_at, updated_at, slug, title, description, is_published, published_version_id')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, policies: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));

    const title = String(body?.title || '').trim();
    const description = body?.description != null ? String(body.description) : null;
    const contentHtml = String(body?.contentHtml || '').trim();
    const isPublished = !!body?.isPublished;

    if (!title || !contentHtml) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 });
    }
    if (contentHtml.length > 200000) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 });
    }

    const slug = body?.slug ? slugify(String(body.slug)) : slugify(title);
    const now = new Date().toISOString();
    const supabase = getServerSupabase();

    const pol = await supabase
      .from('governance_policies')
      .insert([{ slug, title, description, is_published: false, updated_at: now }])
      .select('id, created_at, updated_at, slug, title, description, is_published, published_version_id')
      .single();
    if (pol.error) throw pol.error;

    const version = await supabase
      .from('governance_policy_versions')
      .insert([
        {
          policy_id: pol.data.id,
          version_number: 1,
          content_html: contentHtml,
          created_by_email: user.email || null,
        },
      ])
      .select('id, policy_id, created_at, version_number, content_html, created_by_email')
      .single();
    if (version.error) throw version.error;

    if (isPublished) {
      const pub = await supabase
        .from('governance_policies')
        .update({ is_published: true, published_version_id: version.data.id, updated_at: now })
        .eq('id', pol.data.id)
        .select('id, created_at, updated_at, slug, title, description, is_published, published_version_id')
        .single();
      if (pub.error) throw pub.error;
      pol.data = pub.data as any;
    }

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_POLICY_CREATE',
        target_id: String(pol.data?.id || ''),
        details: { slug, title, isPublished },
      },
    ]);

    return NextResponse.json({ ok: true, policy: pol.data, version: version.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

