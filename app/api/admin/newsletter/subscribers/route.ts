import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface NewsletterSubscriberRow {
  id?: string | number | null;
  email?: string | null;
  categories?: string[] | null;
  consent?: boolean | null;
  source?: string | null;
  preferences?: Record<string, unknown> | null;
  created_at?: string | null;
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
      .from('newsletter_subscriptions')
      .select('id,email,categories,consent,source,preferences,created_at')
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    const subscribers: NewsletterSubscriberRow[] = Array.isArray(res.data) ? res.data : [];
    return NextResponse.json({ ok: true, subscribers });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
