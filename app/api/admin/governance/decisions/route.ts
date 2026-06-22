import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

const allowedStatuses = ['draft', 'approved', 'rejected', 'archived'] as const;
type GovernanceDecisionStatus = (typeof allowedStatuses)[number];
const allowedStatusSet = new Set<string>(allowedStatuses);

interface GovernanceDecisionRow {
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  meeting_id?: string | null;
  meeting_title?: string | null;
  title?: string | null;
  summary_html?: string | null;
  status?: GovernanceDecisionStatus | null;
  decided_at?: string | null;
  is_published?: boolean | null;
  created_by_email?: string | null;
}

interface CreateDecisionBody {
  title?: unknown;
  summaryHtml?: unknown;
  meetingId?: unknown;
  meetingTitle?: unknown;
  status?: unknown;
  isPublished?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const meetingId = url.searchParams.get('meetingId');
    const published = url.searchParams.get('published');

    const supabase = getServerSupabase();
    let q = supabase
      .from('governance_decisions')
      .select('id, created_at, updated_at, meeting_id, meeting_title, title, summary_html, status, decided_at, is_published, created_by_email')
      .order('created_at', { ascending: false })
      .limit(500);

    if (meetingId) q = q.eq('meeting_id', meetingId);
    if (published === 'true') q = q.eq('is_published', true);
    if (published === 'false') q = q.eq('is_published', false);

    const res = await q;
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, decisions: (res.data || []) as GovernanceDecisionRow[] });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = toRecord(await req.json().catch(() => ({}))) as CreateDecisionBody;
    const title = String(body.title || '').trim();
    const summaryHtml = String(body.summaryHtml || '').trim();
    const meetingId = body.meetingId ? String(body.meetingId) : null;
    const meetingTitle = body.meetingTitle ? String(body.meetingTitle) : null;
    const status = body.status ? String(body.status) : 'draft';
    const isPublished = body.isPublished === true;

    if (!title || !summaryHtml) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!allowedStatusSet.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 });
    }
    if (summaryHtml.length > 50000) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const decidedAt = status === 'approved' ? now : null;

    const supabase = getServerSupabase();
    const ins = await supabase
      .from('governance_decisions')
      .insert([
        {
          title,
          summary_html: summaryHtml,
          meeting_id: meetingId,
          meeting_title: meetingTitle,
          status,
          decided_at: decidedAt,
          is_published: isPublished,
          created_by_email: user.email || null,
          updated_at: now,
        },
      ])
      .select('id, created_at, updated_at, meeting_id, meeting_title, title, summary_html, status, decided_at, is_published, created_by_email')
      .single();
    if (ins.error) throw ins.error;

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Governance',
        action: 'GOV_DECISION_CREATE',
        target_id: String(ins.data?.id || ''),
        details: {
          meetingId,
          meetingTitle,
          title,
          status,
          isPublished,
        },
      },
    ]);

    return NextResponse.json({ ok: true, decision: ins.data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
