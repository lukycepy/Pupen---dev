import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

interface GovernanceDecisionRow {
  id?: string | null;
  created_at?: string | null;
  meeting_id?: string | null;
  meeting_title?: string | null;
  title?: string | null;
  summary_html?: string | null;
  status?: string | null;
  decided_at?: string | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('governance_decisions')
      .select('id, created_at, meeting_id, meeting_title, title, summary_html, status, decided_at')
      .eq('is_published', true)
      .order('decided_at', { ascending: false })
      .limit(300);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, decisions: (res.data || []) as GovernanceDecisionRow[] });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
