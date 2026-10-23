import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface NewsletterExportRow {
  email?: string | null;
  categories?: string[] | null;
  created_at?: string | null;
}

function csvEscape(value: unknown) {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();

    // Log the export action
    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Admin API',
        action: 'EXPORT_DOWNLOAD',
        target_id: 'newsletter_subscribers',
        details: { format: 'csv', exportedBy: user.id },
      },
    ]);

    const res = await supabase
      .from('newsletter_subscriptions')
      .select('email,categories,created_at')
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;

    const subscribers: NewsletterExportRow[] = Array.isArray(res.data) ? res.data : [];
    const rows = subscribers.map((subscriber) => [
      csvEscape(subscriber.email || ''),
      csvEscape(Array.isArray(subscriber.categories) ? subscriber.categories.join('; ') : ''),
      csvEscape(subscriber.created_at ? new Date(subscriber.created_at).toISOString() : ''),
    ]);

    const csv = [['Email', 'Kategorie', 'Datum přihlášení'], ...rows].map((row) => row.join(',')).join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="newsletter_subscribers.csv"',
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
