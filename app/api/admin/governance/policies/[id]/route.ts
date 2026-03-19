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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { id } = await ctx.params;
    const policyId = String(id || '').trim();
    if (!policyId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const patch: any = {};

    if (body?.title != null) patch.title = String(body.title).trim();
    if (body?.description !== undefined) patch.description = body.description != null ? String(body.description) : null;
    if (body?.slug != null) patch.slug = slugify(String(body.slug));

    if (patch.title !== undefined && !patch.title) return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    if (patch.title && patch.title.length > 200) return NextResponse.json({ error: 'Title too long' }, { status: 400 });
    if (patch.slug !== undefined && !patch.slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

    patch.updated_at = new Date().toISOString();

    const supabase = getServerSupabase();
    const upd = await supabase
      .from('governance_policies')
      .update(patch)
      .eq('id', policyId)
      .select('id, created_at, updated_at, slug, title, description, is_published, published_version_id')
      .single();
    if (upd.error) throw upd.error;

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_POLICY_UPDATE',
        target_id: policyId,
        details: patch,
      },
    ]);

    return NextResponse.json({ ok: true, policy: upd.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { id } = await ctx.params;
    const policyId = String(id || '').trim();
    if (!policyId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const del = await supabase.from('governance_policies').delete().eq('id', policyId);
    if (del.error) throw del.error;

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_POLICY_DELETE',
        target_id: policyId,
        details: { deletedAt: new Date().toISOString() },
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
