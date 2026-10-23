import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { loadWaitlistOfferByToken, updateWaitlistOfferStatus } from '@/lib/rsvp/waitlistOffers';
import { updateEventOrderStatus, getPaymentBankAccount, mapRsvpStatusToOrderStatus } from '@/lib/rsvp/orders';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { buildEventCalendarAttachment } from '@/lib/tickets/calendarInvite';
import { ensureGuardianConsentPdf, getMinorAttendees } from '@/lib/rsvp/guardianConsent';
import { buildTicketPdfAttachment, buildTicketPdfUrl } from '@/lib/tickets/pdf';

type EventRow = {
  id?: string | null;
  title?: string | null;
  date?: string | null;
};

type RsvpRow = {
  id?: string | null;
  event_id?: string | null;
  event_order_id?: string | null;
  email?: string | null;
  name?: string | null;
  status?: string | null;
  attendees?: unknown;
  payment_method?: string | null;
  qr_token?: string | null;
  qr_code?: string | null;
  variable_symbol?: string | null;
  price_total?: number | null;
  pricing_label?: string | null;
  pricing_label_en?: string | null;
  expires_at?: string | null;
  guardian_consent_document_bucket?: string | null;
  guardian_consent_document_path?: string | null;
};

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function loadRsvp(supabase: ReturnType<typeof getServerSupabase>, rsvpId: string) {
  const withExtras =
    'id, event_id, event_order_id, email, name, status, attendees, payment_method, qr_token, qr_code, variable_symbol, price_total, pricing_label, pricing_label_en, expires_at, guardian_consent_document_bucket, guardian_consent_document_path';
  const fallback = 'id, event_id, email, name, status, attendees, payment_method, qr_token, qr_code, expires_at';
  let res = await supabase.from('rsvp').select(withExtras).eq('id', rsvpId).maybeSingle();
  if (
    res.error &&
    /(event_order_id|variable_symbol|price_total|pricing_label)/i.test(res.error.message) &&
    /(schema cache|does not exist|column)/i.test(res.error.message)
  ) {
    res = await supabase.from('rsvp').select(fallback).eq('id', rsvpId).maybeSingle();
  }
  if (res.error) throw res.error;
  return (res.data || null) as RsvpRow | null;
}

function serializeOfferState(
  offer: Awaited<ReturnType<typeof loadWaitlistOfferByToken>>,
  rsvp: RsvpRow | null,
  event: EventRow | null,
  lang: 'cs' | 'en',
) {
  const now = new Date();
  const expired = !!offer?.expires_at && new Date(String(offer.expires_at)) <= now;
  const status =
    !offer ? 'invalid' : offer.status === 'claimed' ? 'claimed' : offer.status === 'cancelled' ? 'cancelled' : expired ? 'expired' : 'pending';

  return {
    ok: !!offer,
    offerStatus: status,
    offer: offer
      ? {
          id: String(offer.id || ''),
          eventId: String(offer.event_id || ''),
          rsvpId: String(offer.rsvp_id || ''),
          eventTitle: String(event?.title || ''),
          name: String(rsvp?.name || ''),
          email: String(rsvp?.email || offer.recipient_email || ''),
          attendees: Array.isArray(rsvp?.attendees) ? rsvp?.attendees : [],
          priceTotal: typeof rsvp?.price_total === 'number' ? rsvp.price_total : 0,
          pricingLabel:
            lang === 'en' && rsvp?.pricing_label_en ? String(rsvp.pricing_label_en) : rsvp?.pricing_label ? String(rsvp.pricing_label) : '',
          variableSymbol: String(rsvp?.variable_symbol || ''),
          paymentMethod: String(rsvp?.payment_method || 'hotove'),
          expiresAt: String(offer.expires_at || ''),
          claimedAt: offer.claimed_at ? String(offer.claimed_at) : null,
          status: String(rsvp?.status || ''),
        }
      : null,
  };
}

export async function GET(req: Request) {
  const supabase = getServerSupabase();
  try {
    const url = new URL(req.url);
    const token = asTrimmedString(url.searchParams.get('token'));
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'cs';
    if (!token) return NextResponse.json({ ok: false, offerStatus: 'invalid' }, { status: 400 });

    const offer = await loadWaitlistOfferByToken(supabase, token);
    if (!offer) return NextResponse.json({ ok: false, offerStatus: 'invalid' }, { status: 404 });
    const rsvp = offer.rsvp_id ? await loadRsvp(supabase, String(offer.rsvp_id)).catch(() => null) : null;
    const eventRes = offer.event_id ? await supabase.from('events').select('id, title, date').eq('id', String(offer.event_id)).maybeSingle() : null;
    const event = (eventRes?.data || null) as EventRow | null;
    return NextResponse.json(serializeOfferState(offer, rsvp, event, lang));
  } catch (error) {
    return NextResponse.json({ ok: false, offerStatus: 'invalid', error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await guardPublicJsonPost(req, { keyPrefix: 'rsvp:waitlist-offer-claim', max: 10, windowMs: 60_000 });
  if (!guard.ok) return guard.response;

  const supabase = getServerSupabase();
  try {
    const body = guard.body;
    const token = asTrimmedString(body?.token);
    const lang = body?.lang === 'en' ? 'en' : 'cs';
    if (!token) return NextResponse.json({ ok: false, offerStatus: 'invalid' }, { status: 400 });

    const offer = await loadWaitlistOfferByToken(supabase, token);
    if (!offer) return NextResponse.json({ ok: false, offerStatus: 'invalid' }, { status: 404 });

    const rsvp = offer.rsvp_id ? await loadRsvp(supabase, String(offer.rsvp_id)).catch(() => null) : null;
    const eventRes = offer.event_id ? await supabase.from('events').select('id, title, date').eq('id', String(offer.event_id)).maybeSingle() : null;
    const event = (eventRes?.data || null) as EventRow | null;
    const baseState = serializeOfferState(offer, rsvp, event, lang);

    if (offer.status === 'claimed') return NextResponse.json(baseState);
    if (offer.status === 'cancelled') return NextResponse.json(baseState, { status: 410 });
    if (offer.expires_at && new Date(String(offer.expires_at)) <= new Date()) {
      if (offer.id) {
        await updateWaitlistOfferStatus(supabase, String(offer.id), { status: 'expired' }).catch(() => {});
      }
      return NextResponse.json({ ...baseState, offerStatus: 'expired' }, { status: 410 });
    }
    if (!rsvp?.id || !event?.id) return NextResponse.json(baseState, { status: 404 });
    if (rsvp.status !== 'waitlist') return NextResponse.json(baseState, { status: 409 });

    const method = String(rsvp.payment_method || 'hotove');
    const nextStatus = method === 'prevod' ? 'reserved' : 'confirmed';
    const claimedAt = new Date().toISOString();

    const offerUpdate = await supabase
      .from('waitlist_offers')
      .update({ status: 'claimed', claimed_at: claimedAt, cancelled_at: null })
      .eq('id', String(offer.id || ''))
      .eq('status', 'pending');
    if (offerUpdate.error) throw offerUpdate.error;

    let rsvpUpdate = await supabase
      .from('rsvp')
      .update({
        status: nextStatus,
        expires_at: method === 'prevod' ? String(offer.expires_at || '') : null,
        payment_due_at: method === 'prevod' ? String(offer.expires_at || '') : null,
        paid_at: nextStatus === 'confirmed' ? claimedAt : null,
      })
      .eq('id', String(rsvp.id));
    if (
      rsvpUpdate.error &&
      /(payment_due_at|paid_at)/i.test(rsvpUpdate.error.message) &&
      /(schema cache|does not exist|column)/i.test(rsvpUpdate.error.message)
    ) {
      rsvpUpdate = await supabase
        .from('rsvp')
        .update({ status: nextStatus, expires_at: method === 'prevod' ? String(offer.expires_at || '') : null })
        .eq('id', String(rsvp.id));
    }
    if (rsvpUpdate.error) throw rsvpUpdate.error;

    if (rsvp.event_order_id) {
      await updateEventOrderStatus(supabase, String(rsvp.event_order_id), {
        status: mapRsvpStatusToOrderStatus(nextStatus),
        reservationExpiresAt: method === 'prevod' ? String(offer.expires_at || '') : null,
        paidAt: nextStatus === 'confirmed' ? claimedAt : null,
      }).catch(() => {});
    }

    try {
      const minors = getMinorAttendees(rsvp.attendees, event.date);
      const guardianConsent = await ensureGuardianConsentPdf({ event, rsvp, minors, lang });
      const bankAccount = await getPaymentBankAccount(supabase);
      const transporter = await getMailerWithSettingsOrQueueTransporter();
      const from = await getSenderFromSettings();
      const ticketPdfAttachment = await buildTicketPdfAttachment({ event, rsvp: { ...rsvp, status: nextStatus }, lang });
      const { subject, html } = await renderEmailTemplateWithDbOverride('ticket', {
        email: String(rsvp.email || offer.recipient_email || ''),
        name: String(rsvp.name || rsvp.email || offer.recipient_email || ''),
        eventTitle: String(event.title || ''),
        attendees: Array.isArray(rsvp.attendees) ? rsvp.attendees : [],
        paymentMethod: method,
        qrToken: String(rsvp.qr_code || rsvp.qr_token || ''),
        status: nextStatus,
        bankAccount,
        vs: String(rsvp.variable_symbol || ''),
        dueDate: method === 'prevod' ? String(offer.expires_at || '') : '',
        priceTotal: Number(rsvp.price_total || 0),
        pricingLabel: String(rsvp.pricing_label || ''),
        pricingLabelEn: String(rsvp.pricing_label_en || ''),
        ticketPdfUrl: buildTicketPdfUrl(String(rsvp.qr_code || rsvp.qr_token || ''), lang),
        guardianConsentUrl: guardianConsent.downloadUrl,
        guardianConsentUploadUrl: guardianConsent.uploadUrl,
        lang,
      });
      const calendarAttachment = nextStatus === 'confirmed' ? await buildEventCalendarAttachment(String(event.id), lang) : null;
      await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'ticket', eventId: String(event.id), rsvpId: String(rsvp.id), status: nextStatus, email: String(rsvp.email || offer.recipient_email || '') },
        message: {
          from,
          to: String(rsvp.email || offer.recipient_email || ''),
          subject,
          html,
          text: stripHtmlToText(html),
          attachments: [calendarAttachment, ticketPdfAttachment, guardianConsent.attachment].filter(Boolean) as any,
        },
      });
    } catch {}

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: 'system',
          admin_name: 'WaitlistOffer',
          action: 'WAITLIST_OFFER_CLAIMED',
          target_id: String(event.id),
          details: {
            offerId: String(offer.id || ''),
            rsvpId: String(rsvp.id || ''),
            email: String(rsvp.email || offer.recipient_email || ''),
            fromStatus: 'waitlist',
            toStatus: nextStatus,
            claimedAt,
            offerExpiresAt: offer.expires_at || null,
          },
        },
      ]);
    } catch {}

    const freshOffer = await loadWaitlistOfferByToken(supabase, token);
    const freshRsvp = await loadRsvp(supabase, String(rsvp.id));
    return NextResponse.json(serializeOfferState(freshOffer, freshRsvp, event, lang));
  } catch (error) {
    return NextResponse.json({ ok: false, offerStatus: 'invalid', error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}
