import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { normalizeEntryValue } from '@/lib/tickets/blacklist';

interface TicketBlacklistBody {
  entries?: unknown;
}

interface TicketBlacklistEntryInput {
  value?: unknown;
  note?: unknown;
}

interface TicketBlacklistEntry {
  value: string;
  note: string;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeEntries(input: unknown) {
  return (Array.isArray(input) ? input : [])
    .map((entry) => {
      const record = toRecord(entry) as TicketBlacklistEntryInput;
      return {
        value: normalizeEntryValue(String(record.value || '')),
        note: record.note ? String(record.note).trim() : '',
      };
    })
    .filter((entry): entry is TicketBlacklistEntry => Boolean(entry.value))
    .slice(0, 500);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = toRecord(await req.json().catch(() => ({}))) as TicketBlacklistBody;
    const normalized = normalizeEntries(body.entries);

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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
