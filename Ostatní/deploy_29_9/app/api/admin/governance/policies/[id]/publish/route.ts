import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface PublishPolicyBody {
  publish?: unknown;
  versionId?: unknown;
}

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

interface GovernancePolicyVersionLookupRow {
  id?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { id } = await ctx.params;
    const policyId = String(id || '').trim();
    if (!policyId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = toRecord(await req.json().catch(() => ({}))) as PublishPolicyBody;
    const publish = body.publish === undefined ? true : body.publish === true;
    const versionId = body.versionId ? String(body.versionId) : null;
    const now = new Date().toISOString();

    const supabase = getServerSupabase();

    if (!publish) {
      const upd = await supabase
        .from('governance_policies')
        .update({ is_published: false, updated_at: now })
        .eq('id', policyId)
        .select('id, created_at, updated_at, slug, title, description, is_published, published_version_id')
        .single();
      if (upd.error) throw upd.error;

      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: 'Governance',
          action: 'GOV_POLICY_UNPUBLISH',
          target_id: policyId,
          details: { unpublishedAt: now },
        },
      ]);

      return NextResponse.json({ ok: true, policy: upd.data as GovernancePolicyRow });
    }

    let publishVersionId = versionId;
    if (!publishVersionId) {
      const last = await supabase
        .from('governance_policy_versions')
        .select('id')
        .eq('policy_id', policyId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last.error) throw last.error;
      const lastVersion = (last.data || null) as GovernancePolicyVersionLookupRow | null;
      publishVersionId = lastVersion?.id ? String(lastVersion.id) : null;
    }

    if (!publishVersionId) {
      return NextResponse.json({ error: 'No version to publish' }, { status: 400 });
    }

    const upd = await supabase
      .from('governance_policies')
      .update({ is_published: true, published_version_id: publishVersionId, updated_at: now })
      .eq('id', policyId)
      .select('id, created_at, updated_at, slug, title, description, is_published, published_version_id')
      .single();
    if (upd.error) throw upd.error;

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_POLICY_PUBLISH',
        target_id: policyId,
        details: { publishedAt: now, versionId: publishVersionId },
      },
    ]);

    return NextResponse.json({ ok: true, policy: upd.data as GovernancePolicyRow });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
