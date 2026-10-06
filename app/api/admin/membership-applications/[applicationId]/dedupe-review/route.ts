import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationRow {
  id?: string | null;
  email?: string | null;
  status?: string | null;
}

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
    const primaryProfileId = String(body.primaryProfileId || '').trim() || null;
    const note = String(body.note || '').trim().slice(0, 4000) || null;

    const supabase = getServerSupabase();
    const appRes = await supabase.from('membership_applications_v2').select('id,email,status').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (appRes.error) throw appRes.error;
    if (!appRes.data?.id) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: user.user_metadata?.full_name || user.email || 'admin',
        action: 'MEMBERSHIP_APPLICATION_DEDUPE_REVIEWED',
        target_id: id,
        details: {
          email: String(appRes.data.email || '').trim() || null,
          status: String(appRes.data.status || '').trim() || null,
          primary_profile_id: primaryProfileId,
          note,
          reviewed_at: new Date().toISOString(),
        },
      },
    ]);

    return NextResponse.json({ ok: true, primaryProfileId, note });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
