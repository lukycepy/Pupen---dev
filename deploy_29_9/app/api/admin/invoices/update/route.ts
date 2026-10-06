import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface InvoiceUpdateBody {
  rsvpId?: unknown;
  target_id?: unknown;
  status?: unknown;
  note?: unknown;
}

interface InvoiceStatusInsertRow {
  id?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = toRecord(await req.json().catch(() => ({}))) as InvoiceUpdateBody;
    const rsvpId = String(body.rsvpId || body.target_id || '').trim();
    const status = String(body.status || '').trim();
    const note = body.note ? String(body.note).trim().slice(0, 2000) : '';

    if (!rsvpId) return NextResponse.json({ error: 'Missing rsvpId' }, { status: 400 });
    if (!['open', 'done'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    const supabase = getServerSupabase();
    const ins = await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'INVOICE_STATUS',
          target_id: rsvpId,
          details: { status, note: note || null, updatedAt: new Date().toISOString() },
        },
      ])
      .select('id')
      .single();
    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true, id: (ins.data as InvoiceStatusInsertRow | null)?.id || null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
