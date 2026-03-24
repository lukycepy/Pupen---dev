import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function csvEscape(v: any) {
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const res = await supabase
      .from('newsletter_subscriptions')
      .select('email,categories,created_at')
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;

    const rows = (res.data || []).map((r: any) => [
      csvEscape(String(r.email || '')),
      csvEscape(Array.isArray(r.categories) ? r.categories.join('; ') : ''),
      csvEscape(r.created_at ? new Date(r.created_at).toISOString() : ''),
    ]);

    const csv = [['Email', 'Kategorie', 'Datum přihlášení'], ...rows].map((r) => r.join(',')).join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="newsletter_subscribers.csv"',
      },
    });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

