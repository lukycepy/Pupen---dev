import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface NewsletterHistoryRow {
  id?: string | number | null;
  created_at?: string | null;
  subject?: string | null;
  sent_at?: string | null;
  target_count?: number | null;
  open_count?: number | null;
  click_count?: number | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const res = await supabase
      .from('newsletter')
      .select('id,created_at,subject,sent_at,target_count,open_count,click_count')
      .order('sent_at', { ascending: false })
      .limit(50);
    if (res.error) throw res.error;

    const campaigns: NewsletterHistoryRow[] = Array.isArray(res.data) ? res.data : [];
    return NextResponse.json({ ok: true, campaigns });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
