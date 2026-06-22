import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

interface GovernancePolicyRow {
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  published_version_id?: string | null;
}

interface GovernancePolicyVersionRow {
  id?: string | null;
  policy_id?: string | null;
  created_at?: string | null;
  version_number?: number | null;
  content_html?: string | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const supabase = getServerSupabase();
    const pol = await supabase
      .from('governance_policies')
      .select('id, created_at, updated_at, slug, title, description, published_version_id')
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (pol.error) throw pol.error;

    const policies = (pol.data || []) as GovernancePolicyRow[];
    const versionIds = policies
      .map((policy) => String(policy.published_version_id || '').trim())
      .filter(Boolean);

    const versionsById = new Map<string, GovernancePolicyVersionRow>();
    if (versionIds.length) {
      const ver = await supabase
        .from('governance_policy_versions')
        .select('id, policy_id, created_at, version_number, content_html')
        .in('id', versionIds)
        .limit(200);
      if (ver.error) throw ver.error;
      for (const version of (ver.data || []) as GovernancePolicyVersionRow[]) {
        const versionId = String(version.id || '').trim();
        if (versionId) {
          versionsById.set(versionId, version);
        }
      }
    }

    const out = policies.map((policy) => ({
      ...policy,
      version: policy.published_version_id
        ? versionsById.get(String(policy.published_version_id)) || null
        : null,
    }));

    return NextResponse.json({ ok: true, policies: out });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
