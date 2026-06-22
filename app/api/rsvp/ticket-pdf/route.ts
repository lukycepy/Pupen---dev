import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildTicketPdfBytes, buildTicketPdfFileName } from '@/lib/tickets/pdf';

type EventRow = {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
  date?: string | null;
  end_date?: string | null;
  location?: string | null;
  location_en?: string | null;
};

type RsvpRow = {
  id?: string | null;
  event_id?: string | null;
  name?: string | null;
  email?: string | null;
  attendees?: unknown;
  qr_token?: string | null;
  qr_code?: string | null;
  status?: string | null;
  expires_at?: string | null;
  payment_method?: string | null;
  variable_symbol?: string | null;
  price_total?: number | null;
  pricing_label?: string | null;
  pricing_label_en?: string | null;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
};

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isMissingColumnError(message: string) {
  return /(variable_symbol|price_total|pricing_label|checked_in|end_date|location_en)/i.test(message) && /(schema cache|does not exist|column)/i.test(message);
}

export async function GET(req: Request) {
  try {
    const supabase = getServerSupabase();
    const url = new URL(req.url);
    const token = asTrimmedString(url.searchParams.get('token'));
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'cs';
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const rsvpSelect =
      'id, event_id, name, email, attendees, qr_token, qr_code, status, expires_at, payment_method, variable_symbol, price_total, pricing_label, pricing_label_en, checked_in, checked_in_at';
    const rsvpFallback = 'id, event_id, name, email, attendees, qr_token, qr_code, status, expires_at, payment_method';
    let rsvpRes = await supabase.from('rsvp').select(rsvpSelect).or(`qr_token.eq.${token},qr_code.eq.${token}`).maybeSingle();
    if (rsvpRes.error && isMissingColumnError(rsvpRes.error.message)) {
      rsvpRes = await supabase.from('rsvp').select(rsvpFallback).or(`qr_token.eq.${token},qr_code.eq.${token}`).maybeSingle();
    }
    if (rsvpRes.error) throw rsvpRes.error;
    const rsvp = (rsvpRes.data || null) as RsvpRow | null;
    if (!rsvp?.id || !rsvp.event_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const eventSelect = 'id, title, title_en, date, end_date, location, location_en';
    const eventFallback = 'id, title, title_en, date, location';
    let eventRes = await supabase.from('events').select(eventSelect).eq('id', String(rsvp.event_id)).maybeSingle();
    if (eventRes.error && isMissingColumnError(eventRes.error.message)) {
      eventRes = await supabase.from('events').select(eventFallback).eq('id', String(rsvp.event_id)).maybeSingle();
    }
    if (eventRes.error) throw eventRes.error;
    const event = (eventRes.data || null) as EventRow | null;
    if (!event?.id) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const pdf = await buildTicketPdfBytes({ event, rsvp, lang });
    const names = buildTicketPdfFileName({
      eventTitle: lang === 'en' && event.title_en ? String(event.title_en) : String(event.title || ''),
      token,
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${names.ascii}"; filename*=UTF-8''${encodeURIComponent(names.utf8)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}
