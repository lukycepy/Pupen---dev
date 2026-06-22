import { normalizeTicketToken } from './token';

type SupabaseClientLike = {
  from: (table: string) => any;
};

export type TicketValidationStatus =
  | 'valid'
  | 'already_checked_in'
  | 'awaiting_payment'
  | 'waitlist'
  | 'cancelled'
  | 'expired'
  | 'invalid';

type RsvpValidationRow = {
  id?: string | null;
  event_id?: string | null;
  status?: string | null;
  expires_at?: string | null;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
  qr_code?: string | null;
  qr_token?: string | null;
  email?: string | null;
  name?: string | null;
  pricing_label?: string | null;
  pricing_label_en?: string | null;
  price_total?: number | null;
  variable_symbol?: string | null;
  payment_method?: string | null;
  attendees?: unknown;
};

type EventValidationRow = {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
  date?: string | null;
  location?: string | null;
};

type CheckinRow = {
  checked_in_at?: string | null;
  checked_in_by_email?: string | null;
};

export async function loadTicketValidation(
  supabase: SupabaseClientLike,
  input: { token?: unknown; eventId?: unknown; rsvpId?: unknown; lang?: 'cs' | 'en' },
) {
  const token = normalizeTicketToken(input.token);
  const eventId = String(input.eventId || '').trim();
  const rsvpId = String(input.rsvpId || '').trim();
  const lang = input.lang === 'en' ? 'en' : 'cs';

  if (!rsvpId && !token) return { found: false as const, validationStatus: 'invalid' as const };

  const selectWithExtras =
    'id, event_id, status, expires_at, checked_in, checked_in_at, qr_code, qr_token, email, name, pricing_label, pricing_label_en, price_total, variable_symbol, payment_method, attendees';
  const selectFallback = 'id, event_id, status, expires_at, checked_in, checked_in_at, qr_code, qr_token, email, name, attendees';

  const run = (select: string) => {
    if (rsvpId) {
      let query = supabase.from('rsvp').select(select).eq('id', rsvpId);
      if (eventId) query = query.eq('event_id', eventId);
      return query.maybeSingle();
    }

    let query = supabase.from('rsvp').select(select);
    if (eventId) query = query.eq('event_id', eventId);
    return query.or(`qr_code.eq.${token},qr_token.eq.${token}`).maybeSingle();
  };

  let rsvpRes = await run(selectWithExtras);
  if (
    rsvpRes.error &&
    /(pricing_label|price_total|variable_symbol|payment_method)/i.test(rsvpRes.error.message) &&
    /(schema cache|does not exist|column)/i.test(rsvpRes.error.message)
  ) {
    rsvpRes = await run(selectFallback);
  }
  if (rsvpRes.error) throw rsvpRes.error;

  const rsvp = (rsvpRes.data || null) as RsvpValidationRow | null;
  if (!rsvp?.id || !rsvp.event_id) return { found: false as const, validationStatus: 'invalid' as const };

  const eventRes = await supabase
    .from('events')
    .select('id, title, title_en, date, location')
    .eq('id', String(rsvp.event_id))
    .maybeSingle();
  if (eventRes.error) throw eventRes.error;
  const event = (eventRes.data || null) as EventValidationRow | null;

  let firstCheckinAt = rsvp.checked_in_at || null;
  let firstCheckinBy = null as string | null;
  try {
    const checkinRes = await supabase
      .from('rsvp_checkins')
      .select('checked_in_at, checked_in_by_email')
      .eq('event_id', String(rsvp.event_id))
      .eq('rsvp_id', String(rsvp.id))
      .order('checked_in_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!checkinRes.error && checkinRes.data) {
      const checkin = checkinRes.data as CheckinRow;
      firstCheckinAt = checkin.checked_in_at || firstCheckinAt;
      firstCheckinBy = checkin.checked_in_by_email || null;
    }
  } catch {}

  const now = new Date();
  let validationStatus: TicketValidationStatus = 'valid';
  if (rsvp.status === 'cancelled') validationStatus = 'cancelled';
  else if (rsvp.status === 'waitlist') validationStatus = 'waitlist';
  else if (rsvp.status === 'reserved') {
    validationStatus = rsvp.expires_at && new Date(rsvp.expires_at) <= now ? 'expired' : 'awaiting_payment';
  } else if (rsvp.checked_in) {
    validationStatus = 'already_checked_in';
  }

  return {
    found: true as const,
    validationStatus,
    ticket: {
      rsvpId: String(rsvp.id),
      eventId: String(rsvp.event_id),
      eventTitle: lang === 'en' && event?.title_en ? String(event.title_en) : String(event?.title || ''),
      eventDate: event?.date ? String(event.date) : null,
      eventLocation: event?.location ? String(event.location) : null,
      name: String(rsvp.name || ''),
      email: String(rsvp.email || ''),
      status: String(rsvp.status || ''),
      checkedIn: rsvp.checked_in === true,
      checkedInAt: rsvp.checked_in_at ? String(rsvp.checked_in_at) : null,
      firstCheckedInAt: firstCheckinAt ? String(firstCheckinAt) : null,
      firstCheckedInBy: firstCheckinBy,
      paymentMethod: rsvp.payment_method ? String(rsvp.payment_method) : null,
      priceTotal: typeof rsvp.price_total === 'number' ? rsvp.price_total : null,
      pricingLabel:
        lang === 'en' && rsvp.pricing_label_en ? String(rsvp.pricing_label_en) : rsvp.pricing_label ? String(rsvp.pricing_label) : null,
      variableSymbol: rsvp.variable_symbol ? String(rsvp.variable_symbol) : null,
      attendeesCount: Array.isArray(rsvp.attendees) ? rsvp.attendees.length : 1,
      token: token || String(rsvp.qr_token || rsvp.qr_code || ''),
    },
  };
}
