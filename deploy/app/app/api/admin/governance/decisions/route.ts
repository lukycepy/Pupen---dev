import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

const allowedStatuses = new Set(['draft', 'approved', 'rejected', 'archived']);

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

    return NextResponse.json({ ok: true, decisions: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const summaryHtml = String(body?.summaryHtml || '').trim();
    const meetingId = body?.meetingId ? String(body.meetingId) : null;
    const meetingTitle = body?.meetingTitle ? String(body.meetingTitle) : null;
    const status = body?.status ? String(body.status) : 'draft';
    const isPublished = !!body?.isPublished;

    if (!title || !summaryHtml) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!allowedStatuses.has(status)) {
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
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

