import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { DEFAULT_WAITLIST_CONFIG, type WaitlistConfig } from './waitlistConfig';
import { getPaymentBankAccount, mapRsvpStatusToOrderStatus, updateEventOrderStatus } from './orders';
import { buildEventCalendarAttachment } from '@/lib/tickets/calendarInvite';
import { buildTicketPdfAttachment, buildTicketPdfUrl } from '@/lib/tickets/pdf';
import { createWaitlistOffer, loadActiveWaitlistOffers } from './waitlistOffers';

export type AdvanceWaitlistReason = 'cancel' | 'capacity_increase' | 'reservation_expiry' | 'manual_admin' | 'unknown';

export async function advanceWaitlistForEvent(opts: {
  supabase: any;
  eventId: string;
  reason?: AdvanceWaitlistReason;
  config?: WaitlistConfig;
  now?: Date;
  actor?: { email?: string | null; name?: string | null } | null;
  lang?: 'cs' | 'en';
}) {
  const supabase = opts.supabase;
  const eventId = String(opts.eventId || '').trim();
  if (!eventId) return { ok: false, promoted: 0, skipped: 0, reason: 'missing_event_id' as const };

  const now = opts.now instanceof Date ? opts.now : new Date();
  const cfg = opts.config ? opts.config : DEFAULT_WAITLIST_CONFIG;
  const enabled = cfg.enabled !== false;
  if (!enabled) return { ok: true, promoted: 0, skipped: 0, disabled: true as const };

  const reason: AdvanceWaitlistReason = opts.reason || 'unknown';
  const lang = opts.lang === 'en' ? 'en' : 'cs';

  const evRes = await supabase.from('events').select('id,title,capacity').eq('id', eventId).maybeSingle();
  if (evRes.error) throw evRes.error;
  const ev: any = evRes.data;
  const capacity = Number(ev?.capacity || 0);
  if (!capacity || capacity <= 0) return { ok: true, promoted: 0, skipped: 0, reason, capacity: 0 };

  const activeRes = await supabase
    .from('rsvp')
    .select('id,status,expires_at,attendees')
    .eq('event_id', eventId)
    .in('status', ['confirmed', 'reserved']);
  if (activeRes.error) throw activeRes.error;

  let taken = 0;
  for (const rr of activeRes.data || []) {
    if (rr.status === 'reserved' && rr.expires_at && new Date(rr.expires_at) <= now) continue;
    const n = Array.isArray(rr.attendees) ? rr.attendees.length : 1;
    taken += n;
  }

  const activeOffers = await loadActiveWaitlistOffers(supabase, eventId, now);
  const activeOfferRsvpIds = new Set(activeOffers.map((offer) => String(offer.rsvp_id || '')).filter(Boolean));
  const heldByOffers = activeOffers.reduce((sum, offer) => sum + Math.max(1, Number(offer.attendees_count || 1)), 0);

  const free = Math.max(0, capacity - taken - heldByOffers);
  if (free <= 0) return { ok: true, promoted: 0, skipped: 0, reason, capacity, taken, free };

  const loadCandidates = async (withOrderFields: boolean) => {
    const select = withOrderFields
      ? 'id,email,name,payment_method,attendees,qr_token,qr_code,created_at,event_order_id,variable_symbol,price_total,pricing_label,pricing_label_en'
      : 'id,email,name,payment_method,attendees,qr_token,qr_code,created_at';
    return supabase
      .from('rsvp')
      .select(select)
      .eq('event_id', eventId)
      .eq('status', 'waitlist')
      .order('created_at', { ascending: true })
      .limit(Math.min(500, Math.max(10, cfg.maxPromotionsPerRun * 5)));
  };
  let candidatesRes = await loadCandidates(true);
  if (
    candidatesRes.error &&
    /(event_order_id|variable_symbol|price_total|pricing_label)/i.test(candidatesRes.error.message) &&
    /(schema cache|does not exist|column)/i.test(candidatesRes.error.message)
  ) {
    candidatesRes = await loadCandidates(false);
  }
  if (candidatesRes.error) throw candidatesRes.error;
  const candidates: any[] = candidatesRes.data || [];
  if (!candidates.length) return { ok: true, promoted: 0, skipped: 0, reason, capacity, taken, free };

  const bankAccount = await getPaymentBankAccount(supabase);

  const transporter = cfg.notifyOnPromotion ? await getMailerWithSettingsOrQueueTransporter() : null;
  const from = cfg.notifyOnPromotion ? await getSenderFromSettings() : null;

  let remaining = free;
  let promoted = 0;
  let skipped = 0;

  for (const w of candidates) {
    if (promoted >= cfg.maxPromotionsPerRun) break;
    if (remaining <= 0) break;
    if (activeOfferRsvpIds.has(String(w.id || ''))) continue;

    const count = Array.isArray(w.attendees) ? w.attendees.length : 1;
    if (count > remaining) {
      skipped += 1;
      if (cfg.groupHandling === 'skip_non_fit') continue;
      break;
    }

    const method = String(w.payment_method || 'hotove');
    const expiresAt = new Date(now.getTime() + cfg.reservationExpiresHours * 60 * 60 * 1000).toISOString();
    const offer = await createWaitlistOffer(supabase, {
      eventId,
      rsvpId: String(w.id || ''),
      recipientEmail: String(w.email || ''),
      attendeesCount: count,
      expiresAt,
      meta: { reason, paymentMethod: method, createdAt: now.toISOString() },
    });

    // If the migration is not applied yet, keep the older behavior so the slot is not lost.
    if (!offer.persisted) {
      const nextStatus = method === 'prevod' ? 'reserved' : 'confirmed';
      let upd = await supabase
        .from('rsvp')
        .update({ status: nextStatus, expires_at: expiresAt, payment_due_at: expiresAt || null, paid_at: nextStatus === 'confirmed' ? now.toISOString() : null })
        .eq('id', w.id);
      if (
        upd.error &&
        /(payment_due_at|paid_at)/i.test(upd.error.message) &&
        /(schema cache|does not exist|column)/i.test(upd.error.message)
      ) {
        upd = await supabase.from('rsvp').update({ status: nextStatus, expires_at: expiresAt }).eq('id', w.id);
      }
      if (upd.error) throw upd.error;

      if (w.event_order_id) {
        await updateEventOrderStatus(supabase, String(w.event_order_id), {
          status: mapRsvpStatusToOrderStatus(nextStatus),
          reservationExpiresAt: expiresAt,
          paidAt: nextStatus === 'confirmed' ? now.toISOString() : null,
        }).catch(() => {});
      }
    }

    promoted += 1;
    remaining -= count;

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: opts.actor?.email || 'system',
          admin_name: opts.actor?.name || 'Waitlist',
          action: offer.persisted ? 'WAITLIST_OFFER_CREATED' : 'WAITLIST_PROMOTE',
          target_id: String(eventId),
          details: {
            rsvpId: String(w.id || ''),
            email: String(w.email || ''),
            fromStatus: 'waitlist',
            toStatus: offer.persisted ? 'waitlist_offer_pending' : method === 'prevod' ? 'reserved' : 'confirmed',
            reason,
            attendeesCount: count,
            freeBefore: free,
            freeAfter: remaining,
            reservationExpiresHours: cfg.reservationExpiresHours,
            offerId: offer.id,
            offerExpiresAt: expiresAt,
            at: now.toISOString(),
          },
        },
      ]);
    } catch {}

    if (cfg.notifyOnPromotion && transporter && from) {
      try {
        const templateKey = offer.persisted ? 'waitlist_offer' : 'ticket';
        const { subject, html } = await renderEmailTemplateWithDbOverride(templateKey, {
          email: String(w.email || ''),
          name: String(w.name || w.email || ''),
          eventTitle: String(ev?.title || ''),
          attendees: Array.isArray(w.attendees) ? w.attendees : [],
          paymentMethod: method,
          qrToken: String(w.qr_code || w.qr_token || ''),
          status: method === 'prevod' ? 'reserved' : 'confirmed',
          bankAccount,
          vs: String(w.variable_symbol || ''),
          dueDate: expiresAt,
          priceTotal: Number(w.price_total || 0),
          pricingLabel: String(w.pricing_label || ''),
          pricingLabelEn: String(w.pricing_label_en || ''),
          ticketPdfUrl: !offer.persisted ? buildTicketPdfUrl(String(w.qr_code || w.qr_token || ''), lang) : '',
          offerUrl: offer.persisted ? offer.url : '',
          offerExpiresAt: expiresAt,
          lang,
        });
        const calendarAttachment = !offer.persisted && method !== 'prevod' ? await buildEventCalendarAttachment(String(eventId), lang) : null;
        const ticketPdfAttachment =
          !offer.persisted
            ? await buildTicketPdfAttachment({
                event: {
                  id: String(eventId),
                  title: String(ev?.title || ''),
                  title_en: String(ev?.title_en || ''),
                  date: String(ev?.date || ''),
                  location: String(ev?.location || ''),
                  location_en: String(ev?.location_en || ''),
                },
                rsvp: {
                  id: String(w.id || ''),
                  name: String(w.name || w.email || ''),
                  email: String(w.email || ''),
                  attendees: Array.isArray(w.attendees) ? w.attendees : [],
                  qr_token: String(w.qr_token || ''),
                  qr_code: String(w.qr_code || ''),
                  status: method === 'prevod' ? 'reserved' : 'confirmed',
                  expires_at: expiresAt,
                  payment_method: method,
                  variable_symbol: String(w.variable_symbol || ''),
                  price_total: Number(w.price_total || 0),
                  pricing_label: String(w.pricing_label || ''),
                  pricing_label_en: String(w.pricing_label_en || ''),
                },
                lang,
              })
            : null;
        await sendMailWithQueueFallback({
          transporter,
          supabase,
          meta: { kind: offer.persisted ? 'waitlist_offer' : 'ticket', eventId: String(eventId), rsvpId: String(w.id), email: String(w.email || '') },
          message: {
            from,
            to: String(w.email || ''),
            subject,
            html,
            text: stripHtmlToText(html),
            attachments: [calendarAttachment, ticketPdfAttachment].filter(Boolean) as any,
          },
        });
      } catch {}
    }
  }

  try {
    await supabase.from('admin_logs').insert([
      {
        admin_email: opts.actor?.email || 'system',
        admin_name: opts.actor?.name || 'Waitlist',
        action: 'WAITLIST_ADVANCE_RUN',
        target_id: String(eventId),
        details: {
          reason,
          capacity,
          taken,
          freeBefore: free,
          promoted,
          skipped,
          freeAfter: remaining,
          maxPromotionsPerRun: cfg.maxPromotionsPerRun,
          groupHandling: cfg.groupHandling,
          at: now.toISOString(),
        },
      },
    ]);
  } catch {}

  return { ok: true, promoted, skipped, reason, capacity, taken, freeBefore: free, freeAfter: remaining };
}
