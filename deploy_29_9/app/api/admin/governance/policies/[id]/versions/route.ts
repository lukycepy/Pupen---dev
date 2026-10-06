import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface GovernancePolicyVersionRow {
  id?: string | null;
  policy_id?: string | null;
  created_at?: string | null;
  version_number?: number | null;
  content_html?: string | null;
  created_by_email?: string | null;
}

interface CreatePolicyVersionBody {
  contentHtml?: unknown;
  publish?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    const policyId = String(id || '').trim();
    if (!policyId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase
      .from('governance_policy_versions')
      .select('id, policy_id, created_at, version_number, content_html, created_by_email')
      .eq('policy_id', policyId)
      .order('version_number', { ascending: false })
      .limit(50);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, versions: (res.data || []) as GovernancePolicyVersionRow[] });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { id } = await ctx.params;
    const policyId = String(id || '').trim();
    if (!policyId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = toRecord(await req.json().catch(() => ({}))) as CreatePolicyVersionBody;
    const contentHtml = String(body.contentHtml || '').trim();
    const publish = body.publish === true;

    if (!contentHtml) return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    if (contentHtml.length > 200000) return NextResponse.json({ error: 'Content too long' }, { status: 400 });

    const supabase = getServerSupabase();
    const last = await supabase
      .from('governance_policy_versions')
      .select('version_number')
      .eq('policy_id', policyId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) throw last.error;
    const lastVersion = (last.data || null) as GovernancePolicyVersionRow | null;

    const nextVersion = (lastVersion?.version_number ? Number(lastVersion.version_number) : 0) + 1;

    const ver = await supabase
      .from('governance_policy_versions')
      .insert([
        {
          policy_id: policyId,
          version_number: nextVersion,
          content_html: contentHtml,
          created_by_email: user.email || null,
        },
      ])
      .select('id, policy_id, created_at, version_number, content_html, created_by_email')
      .single();
    if (ver.error) throw ver.error;
    const createdVersion = ver.data as GovernancePolicyVersionRow;

    const now = new Date().toISOString();
    await supabase.from('governance_policies').update({ updated_at: now }).eq('id', policyId);

    if (publish) {
      const pub = await supabase
        .from('governance_policies')
        .update({ is_published: true, published_version_id: createdVersion.id || null, updated_at: now })
        .eq('id', policyId);
      if (pub.error) throw pub.error;
    }

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_POLICY_VERSION_CREATE',
        target_id: policyId,
        details: { version: nextVersion, publish },
      },
    ]);

    return NextResponse.json({ ok: true, version: createdVersion });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
