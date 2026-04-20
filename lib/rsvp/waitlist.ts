import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { DEFAULT_WAITLIST_CONFIG, type WaitlistConfig } from './waitlistConfig';

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

  const free = Math.max(0, capacity - taken);
  if (free <= 0) return { ok: true, promoted: 0, skipped: 0, reason, capacity, taken, free };

  const candidatesRes = await supabase
    .from('rsvp')
    .select('id,email,name,payment_method,attendees,qr_token,qr_code,created_at')
    .eq('event_id', eventId)
    .eq('status', 'waitlist')
    .order('created_at', { ascending: true })
    .limit(Math.min(500, Math.max(10, cfg.maxPromotionsPerRun * 5)));
  if (candidatesRes.error) throw candidatesRes.error;
  const candidates: any[] = candidatesRes.data || [];
  if (!candidates.length) return { ok: true, promoted: 0, skipped: 0, reason, capacity, taken, free };

  let bankAccount = process.env.BANK_ACCOUNT || 'CZ1234567890';
  try {
    const { data } = await supabase.from('payment_settings').select('bank_account').single();
    if (data?.bank_account) bankAccount = String(data.bank_account);
  } catch {}

  const transporter = cfg.notifyOnPromotion ? await getMailerWithSettingsOrQueueTransporter() : null;
  const from = cfg.notifyOnPromotion ? await getSenderFromSettings() : null;

  let remaining = free;
  let promoted = 0;
  let skipped = 0;

  for (const w of candidates) {
    if (promoted >= cfg.maxPromotionsPerRun) break;
    if (remaining <= 0) break;

    const count = Array.isArray(w.attendees) ? w.attendees.length : 1;
    if (count > remaining) {
      skipped += 1;
      if (cfg.groupHandling === 'skip_non_fit') continue;
      break;
    }

    const method = String(w.payment_method || 'hotove');
    const nextStatus = method === 'prevod' ? 'reserved' : 'confirmed';
    const expiresAt =
      nextStatus === 'reserved'
        ? new Date(now.getTime() + cfg.reservationExpiresHours * 60 * 60 * 1000).toISOString()
        : null;

    const upd = await supabase.from('rsvp').update({ status: nextStatus, expires_at: expiresAt }).eq('id', w.id);
    if (upd.error) throw upd.error;

    promoted += 1;
    remaining -= count;

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: opts.actor?.email || 'system',
          admin_name: opts.actor?.name || 'Waitlist',
          action: 'WAITLIST_PROMOTE',
          target_id: String(eventId),
          details: {
            rsvpId: String(w.id || ''),
            email: String(w.email || ''),
            fromStatus: 'waitlist',
            toStatus: nextStatus,
            reason,
            attendeesCount: count,
            freeBefore: free,
            freeAfter: remaining,
            reservationExpiresHours: cfg.reservationExpiresHours,
            at: now.toISOString(),
          },
        },
      ]);
    } catch {}

    if (cfg.notifyOnPromotion && transporter && from) {
      try {
        const { subject, html } = await renderEmailTemplateWithDbOverride('ticket', {
          email: String(w.email || ''),
          name: String(w.name || w.email || ''),
          eventTitle: String(ev?.title || ''),
          attendees: Array.isArray(w.attendees) ? w.attendees : [],
          paymentMethod: method,
          qrToken: String(w.qr_code || w.qr_token || ''),
          status: nextStatus,
          bankAccount,
          lang,
        });
        await sendMailWithQueueFallback({
          transporter,
          supabase,
          meta: { kind: 'ticket', eventId: String(eventId), rsvpId: String(w.id), status: nextStatus, email: String(w.email || '') },
          message: { from, to: String(w.email || ''), subject, html, text: stripHtmlToText(html) },
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

