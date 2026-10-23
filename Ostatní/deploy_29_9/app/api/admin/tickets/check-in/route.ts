import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { normalizeTicketToken } from '@/lib/tickets/token';
import { loadTicketValidation } from '@/lib/tickets/validation';

interface TicketCheckInBody {
  eventId?: unknown;
  event_id?: unknown;
  rsvpId?: unknown;
  rsvp_id?: unknown;
  token?: unknown;
  qr?: unknown;
  checkedIn?: unknown;
  source?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = toRecord(await req.json().catch(() => ({}))) as TicketCheckInBody;
    const eventId = String(body.eventId || body.event_id || '').trim();
    const rsvpId = String(body.rsvpId || body.rsvp_id || '').trim();
    const token = normalizeTicketToken(String(body.token || body.qr || ''));
    const checkedIn = body.checkedIn === false ? false : true;
    const source = body.source ? String(body.source).slice(0, 40) : null;

    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    if (!rsvpId && !token) return NextResponse.json({ error: 'Missing rsvpId/token' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date();

    const validation = await loadTicketValidation(supabase, { token, eventId, rsvpId, lang: 'cs' });
    if (!validation.found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const r = validation.ticket;
    if (validation.validationStatus === 'cancelled') return NextResponse.json({ error: 'Cancelled', validation }, { status: 400 });
    if (validation.validationStatus === 'expired') return NextResponse.json({ error: 'Expired', validation }, { status: 400 });
    if (validation.validationStatus === 'awaiting_payment') return NextResponse.json({ error: 'AwaitingPayment', validation }, { status: 400 });
    if (validation.validationStatus === 'waitlist') return NextResponse.json({ error: 'Waitlist', validation }, { status: 400 });

    if (checkedIn) {
      if (r.checkedIn) {
        return NextResponse.json({ ok: true, status: 'already_checked_in', rsvpId: r.rsvpId, ticket: validation.ticket });
      }

      const ins = await supabase
        .from('rsvp_checkins')
        .upsert(
          [
            {
              event_id: eventId,
              rsvp_id: r.rsvpId,
              checked_in_at: now.toISOString(),
              checked_in_by_email: user.email || 'admin',
              source,
              raw: { token, by: user.email || null },
            },
          ],
          { onConflict: 'event_id,rsvp_id', ignoreDuplicates: true },
        )
        .select('id')
        .maybeSingle();
      if (ins.error) throw ins.error;

      await supabase.from('rsvp').update({ checked_in: true, checked_in_at: now.toISOString() }).eq('id', r.rsvpId);

      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: 'CheckIn',
          action: 'TICKET_CHECKIN',
          target_id: String(eventId),
          details: { rsvpId: r.rsvpId, token: token || r.token || null, email: r.email || null, name: r.name || null },
        },
      ]);

      return NextResponse.json({
        ok: true,
        status: 'checked_in',
        rsvpId: r.rsvpId,
        ticket: { ...validation.ticket, checkedIn: true, checkedInAt: now.toISOString(), firstCheckedInAt: now.toISOString() },
      });
    }

    if (!r.checkedIn) return NextResponse.json({ ok: true, status: 'already_not_checked_in', rsvpId: r.rsvpId, ticket: validation.ticket });

    await supabase.from('rsvp_checkins').delete().eq('event_id', eventId).eq('rsvp_id', r.rsvpId);
    await supabase.from('rsvp').update({ checked_in: false }).eq('id', r.rsvpId);

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'CheckIn',
        action: 'TICKET_CHECKIN_UNDO',
        target_id: String(eventId),
        details: { rsvpId: r.rsvpId, token: token || r.token || null, email: r.email || null, name: r.name || null },
      },
    ]);

    return NextResponse.json({ ok: true, status: 'unchecked', rsvpId: r.rsvpId, ticket: { ...validation.ticket, checkedIn: false, checkedInAt: null } });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
