import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { applyMembershipMergePrep } from '@/lib/membership-applications/mergePrep';

type JsonRecord = Record<string, unknown>;

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const body = toRecord(await req.json().catch(() => ({})));
    const sourceProfileId = String(body.sourceProfileId || '').trim();
    const targetProfileId = String(body.targetProfileId || '').trim();
    if (!sourceProfileId || !targetProfileId) {
      return NextResponse.json({ error: 'Missing source or target profile id' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const appRes = await supabase.from('membership_applications_v2').select('id').eq('id', id).maybeSingle();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const result = await applyMembershipMergePrep({
      supabase,
      sourceProfileId,
      targetProfileId,
      actorEmail: user.email || null,
    });

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: user.user_metadata?.full_name || user.email || 'admin',
        action: 'MEMBERSHIP_APPLICATION_MERGE_PREP_APPLIED',
        target_id: id,
        details: {
          source_profile_id: sourceProfileId,
          target_profile_id: targetProfileId,
          roles_inserted: result.rolesInserted,
          roles_removed_from_source: result.rolesRemovedFromSource,
          applications_relinked: result.applicationsRelinked,
          applications_blocked_by_db_guard: result.applicationsBlockedByDbGuard,
          target_profile_patched: result.targetProfilePatched,
          warnings: result.warnings,
        },
      },
    ]);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : message === 'Invalid merge pair' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
