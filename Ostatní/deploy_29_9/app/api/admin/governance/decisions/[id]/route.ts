import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

const allowedStatuses = ['draft', 'approved', 'rejected', 'archived'] as const;
type GovernanceDecisionStatus = (typeof allowedStatuses)[number];
const allowedStatusSet = new Set<string>(allowedStatuses);

interface UpdateDecisionBody {
  title?: unknown;
  summaryHtml?: unknown;
  meetingId?: unknown;
  meetingTitle?: unknown;
  status?: unknown;
  isPublished?: unknown;
}

interface DecisionPatch {
  title?: string;
  summary_html?: string;
  meeting_id?: string | null;
  meeting_title?: string | null;
  status?: GovernanceDecisionStatus;
  is_published?: boolean;
  updated_at?: string;
  decided_at?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { id } = await ctx.params;
    const decisionId = String(id || '').trim();
    if (!decisionId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = toRecord(await req.json().catch(() => ({}))) as UpdateDecisionBody;
    const patch: DecisionPatch = {};

    if (body.title != null) patch.title = String(body.title).trim();
    if (body.summaryHtml != null) patch.summary_html = String(body.summaryHtml).trim();
    if (body.meetingId !== undefined) patch.meeting_id = body.meetingId ? String(body.meetingId) : null;
    if (body.meetingTitle !== undefined) patch.meeting_title = body.meetingTitle ? String(body.meetingTitle) : null;
    if (body.status != null) patch.status = String(body.status) as GovernanceDecisionStatus;
    if (body.isPublished !== undefined) patch.is_published = body.isPublished === true;

    if (patch.title !== undefined && !patch.title) return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    if (patch.title && patch.title.length > 200) return NextResponse.json({ error: 'Title too long' }, { status: 400 });
    if (patch.summary_html !== undefined && !patch.summary_html) return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    if (patch.summary_html && patch.summary_html.length > 50000) return NextResponse.json({ error: 'Content too long' }, { status: 400 });

    if (patch.status !== undefined && !allowedStatusSet.has(patch.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const now = new Date().toISOString();
    patch.updated_at = now;
    if (patch.status === 'approved') patch.decided_at = now;
    if (patch.status && patch.status !== 'approved') patch.decided_at = null;

    const supabase = getServerSupabase();
    const upd = await supabase
      .from('governance_decisions')
      .update(patch)
      .eq('id', decisionId)
      .select('id, created_at, updated_at, meeting_id, meeting_title, title, summary_html, status, decided_at, is_published, created_by_email')
      .single();
    if (upd.error) throw upd.error;

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_DECISION_UPDATE',
        target_id: decisionId,
        details: patch,
      },
    ]);

    return NextResponse.json({ ok: true, decision: upd.data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const { id } = await ctx.params;
    const decisionId = String(id || '').trim();
    if (!decisionId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const del = await supabase.from('governance_decisions').delete().eq('id', decisionId);
    if (del.error) throw del.error;

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_DECISION_DELETE',
        target_id: decisionId,
        details: { deletedAt: new Date().toISOString() },
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
