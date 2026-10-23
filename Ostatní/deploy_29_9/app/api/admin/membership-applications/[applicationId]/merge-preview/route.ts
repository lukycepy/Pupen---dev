import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMembershipMergePreview } from '@/lib/membership-applications/mergePrep';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    await requireAdmin(req);
    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const url = new URL(req.url);
    const sourceProfileId = String(url.searchParams.get('sourceProfileId') || '').trim();
    const targetProfileId = String(url.searchParams.get('targetProfileId') || '').trim();
    if (!sourceProfileId || !targetProfileId) {
      return NextResponse.json({ error: 'Missing source or target profile id' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const appRes = await supabase.from('membership_applications_v2').select('id').eq('id', id).maybeSingle();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const preview = await getMembershipMergePreview({ supabase, sourceProfileId, targetProfileId });
    return NextResponse.json(preview);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : message === 'Invalid merge pair' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
