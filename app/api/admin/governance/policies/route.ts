import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface GovernancePolicyRow {
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  is_published?: boolean | null;
  published_version_id?: string | null;
}

interface GovernancePolicyVersionRow {
  id?: string | null;
  policy_id?: string | null;
  created_at?: string | null;
  version_number?: number | null;
  content_html?: string | null;
  created_by_email?: string | null;
}

interface CreatePolicyBody {
  title?: unknown;
  description?: unknown;
  contentHtml?: unknown;
  isPublished?: unknown;
  slug?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

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
    return NextResponse.json({ ok: true, policies: (res.data || []) as GovernancePolicyRow[] });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = toRecord(await req.json().catch(() => ({}))) as CreatePolicyBody;

    const title = String(body.title || '').trim();
    const description = body.description != null ? String(body.description) : null;
    const contentHtml = String(body.contentHtml || '').trim();
    const isPublished = body.isPublished === true;

    if (!title || !contentHtml) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 });
    }
    if (contentHtml.length > 200000) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 });
    }

    const slug = typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(title);
    const now = new Date().toISOString();
    const supabase = getServerSupabase();

    const pol = await supabase
      .from('governance_policies')
      .insert([{ slug, title, description, is_published: false, updated_at: now }])
      .select('id, created_at, updated_at, slug, title, description, is_published, published_version_id')
      .single();
    if (pol.error) throw pol.error;
    let policy = pol.data as GovernancePolicyRow;

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
    const createdVersion = version.data as GovernancePolicyVersionRow;

    if (isPublished) {
      const pub = await supabase
        .from('governance_policies')
        .update({ is_published: true, published_version_id: createdVersion.id || null, updated_at: now })
        .eq('id', policy.id)
        .select('id, created_at, updated_at, slug, title, description, is_published, published_version_id')
        .single();
      if (pub.error) throw pub.error;
      policy = pub.data as GovernancePolicyRow;
    }

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_POLICY_CREATE',
        target_id: String(policy.id || ''),
        details: { slug, title, isPublished },
      },
    ]);

    return NextResponse.json({ ok: true, policy, version: createdVersion });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
