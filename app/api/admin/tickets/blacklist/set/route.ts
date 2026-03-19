import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { normalizeEntryValue } from '@/lib/tickets/blacklist';

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const entries = Array.isArray(body?.entries) ? body.entries : [];

    const normalized = entries
      .map((e: any) => ({
        value: normalizeEntryValue(e?.value || ''),
        note: e?.note ? String(e.note).trim() : '',
      }))
      .filter((e: any) => e.value)
      .slice(0, 500);

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'TicketSecurity',
        action: 'TICKET_EMAIL_BLACKLIST',
        target_id: null,
        details: { entries: normalized, updatedAt: new Date().toISOString() },
      },
    ]);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

