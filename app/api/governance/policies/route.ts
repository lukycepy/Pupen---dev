import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

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

    const policies = pol.data || [];
    const versionIds = policies.map((p: any) => p.published_version_id).filter(Boolean);

    const versionsById = new Map<string, any>();
    if (versionIds.length) {
      const ver = await supabase
        .from('governance_policy_versions')
        .select('id, policy_id, created_at, version_number, content_html')
        .in('id', versionIds as any)
        .limit(200);
      if (ver.error) throw ver.error;
      for (const v of ver.data || []) versionsById.set(String(v.id), v);
    }

    const out = policies.map((p: any) => ({
      ...p,
      version: p.published_version_id ? versionsById.get(String(p.published_version_id)) || null : null,
    }));

    return NextResponse.json({ ok: true, policies: out });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

