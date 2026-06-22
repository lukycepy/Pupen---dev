import { NextResponse } from 'next/server';
import { enqueueEmailTrigger } from '@/lib/email/triggers';
import { getPublicBaseUrl } from '@/lib/public-base-url';
import { getPaymentBankAccount } from '@/lib/rsvp/orders';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildTicketPdfUrl } from '@/lib/tickets/pdf';

export const runtime = 'nodejs';

type ReminderStage = 'nudge' | 'final';

interface EventOrderRow {
  id?: string | null;
  created_at?: string | null;
  event_id?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  payment_method?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  variable_symbol?: string | null;
  reservation_expires_at?: string | null;
  meta?: Record<string, unknown> | null;
}

interface EventRow {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
}

interface RsvpRow {
  id?: string | null;
  event_id?: string | null;
  event_order_id?: string | null;
  email?: string | null;
  name?: string | null;
  attendees?: unknown;
  qr_token?: string | null;
  qr_code?: string | null;
  price_total?: number | string | null;
  pricing_label?: string | null;
  pricing_label_en?: string | null;
}

interface AdminLogReminderRow {
  target_id?: string | null;
  details?: Record<string, unknown> | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Error');
}

function isMissingFeatureError(message: string, feature: string) {
  return new RegExp(feature, 'i').test(message) && /(schema cache|does not exist|column|relation)/i.test(message);
}

function requireCron(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.CRON_SECRET || '';
  if (!expected) return false;
  const got =
    url.searchParams.get('secret') ||
    req.headers.get('x-cron-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  return got === expected;
}

function getLang(meta: Record<string, unknown> | null | undefined): 'cs' | 'en' {
  return meta?.lang === 'en' ? 'en' : 'cs';
}

function toNumber(value: number | string | null | undefined) {
  const n = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getReminderStage(order: EventOrderRow, now = Date.now()): ReminderStage | null {
  const createdAt = new Date(String(order.created_at || '')).getTime();
  const expiresAt = new Date(String(order.reservation_expires_at || '')).getTime();
  if (!createdAt || Number.isNaN(createdAt) || !expiresAt || Number.isNaN(expiresAt) || expiresAt <= now) return null;

  const ageMs = now - createdAt;
  const remainingMs = expiresAt - now;

  if (remainingMs <= 6 * 60 * 60 * 1000) return 'final';
  if (ageMs >= 60 * 60 * 1000) return 'nudge';
  return null;
}

function normalizeAttendees(value: unknown, fallbackName: string) {
  if (!Array.isArray(value)) return fallbackName ? [{ name: fallbackName }] : [];
  return value
    .map((item) => {
      if (typeof item === 'string') return { name: item.trim() };
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const name = String(record.name || '').trim();
        return name ? { ...record, name } : null;
      }
      return null;
    })
    .filter((item): item is Record<string, unknown> => !!item);
}

export async function GET(req: Request) {
  try {
    if (!requireCron(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const limit = Math.min(250, Math.max(1, Number(url.searchParams.get('limit') || 100)));
    const supabase = getServerSupabase();
    const now = Date.now();

    const ordersRes = await supabase
      .from('event_orders')
      .select('id, created_at, event_id, buyer_name, buyer_email, payment_method, status, total_amount, variable_symbol, reservation_expires_at, meta')
      .eq('status', 'reserved')
      .eq('payment_method', 'prevod')
      .not('reservation_expires_at', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (ordersRes.error) {
      if (isMissingFeatureError(ordersRes.error.message, 'event_orders')) {
        return NextResponse.json({ ok: true, scanned: 0, eligible: 0, enqueued: 0, skipped: 'missing_event_orders' });
      }
      throw ordersRes.error;
    }

    const orders = ((ordersRes.data || []) as EventOrderRow[]).filter((order) => {
      if (!order.id || !order.event_id || !order.buyer_email) return false;
      if (!order.reservation_expires_at) return false;
      if (toNumber(order.total_amount) <= 0) return false;
      const expiresAt = new Date(String(order.reservation_expires_at || '')).getTime();
      return !!expiresAt && !Number.isNaN(expiresAt) && expiresAt > now;
    });

    if (!orders.length) {
      return NextResponse.json({ ok: true, scanned: 0, eligible: 0, enqueued: 0, skippedExisting: 0, skippedNoStage: 0, errors: [] });
    }

    const eventIds = Array.from(new Set(orders.map((order) => String(order.event_id || '')).filter(Boolean)));
    const orderIds = Array.from(new Set(orders.map((order) => String(order.id || '')).filter(Boolean)));

    const eventsById = new Map<string, EventRow>();
    if (eventIds.length) {
      const eventsRes = await supabase.from('events').select('id, title, title_en').in('id', eventIds);
      if (!eventsRes.error) {
        for (const event of (eventsRes.data || []) as EventRow[]) {
          const eventId = String(event.id || '');
          if (eventId) eventsById.set(eventId, event);
        }
      }
    }

    const loadRsvps = async (withOrderId: boolean) => {
      const select = withOrderId
        ? 'id, event_id, event_order_id, email, name, attendees, qr_token, qr_code, price_total, pricing_label, pricing_label_en'
        : 'id, event_id, email, name, attendees, qr_token, qr_code, price_total, pricing_label, pricing_label_en';
      return supabase
        .from('rsvp')
        .select(select)
        .in('event_id', eventIds)
        .in('email', Array.from(new Set(orders.map((order) => String(order.buyer_email || '')).filter(Boolean))))
        .in('status', ['reserved', 'confirmed']);
    };

    let rsvpRes = await loadRsvps(true);
    if (rsvpRes.error && isMissingFeatureError(rsvpRes.error.message, 'event_order_id')) {
      rsvpRes = await loadRsvps(false);
    }
    if (rsvpRes.error) throw rsvpRes.error;

    const rsvps = (rsvpRes.data || []) as RsvpRow[];
    const rsvpByOrderId = new Map<string, RsvpRow>();
    const rsvpsByEventEmail = new Map<string, RsvpRow[]>();
    for (const rsvp of rsvps) {
      const orderId = String(rsvp.event_order_id || '');
      if (orderId && !rsvpByOrderId.has(orderId)) rsvpByOrderId.set(orderId, rsvp);
      const key = `${String(rsvp.event_id || '')}:${String(rsvp.email || '').toLowerCase()}`;
      const list = rsvpsByEventEmail.get(key) || [];
      list.push(rsvp);
      rsvpsByEventEmail.set(key, list);
    }

    const existingReminderKeys = new Set<string>();
    if (orderIds.length) {
      const logsRes = await supabase
        .from('admin_logs')
        .select('target_id, details')
        .eq('action', 'RSVP_ABANDONED_CART_REMINDER')
        .in('target_id', orderIds)
        .limit(limit * 4);
      if (!logsRes.error) {
        for (const row of (logsRes.data || []) as AdminLogReminderRow[]) {
          const orderId = String(row.target_id || '');
          const stage = String(row.details?.stage || '').trim();
          if (orderId && stage) existingReminderKeys.add(`${orderId}:${stage}`);
        }
      }
    }

    const bankAccount = await getPaymentBankAccount(supabase);
    const baseUrl = getPublicBaseUrl();

    let eligible = 0;
    let enqueued = 0;
    let skippedExisting = 0;
    let skippedNoStage = 0;
    const errors: Array<{ orderId: string; error: string }> = [];

    for (const order of orders) {
      const orderId = String(order.id || '');
      const eventId = String(order.event_id || '');
      const email = String(order.buyer_email || '').trim();
      if (!orderId || !eventId || !email) continue;

      const stage = getReminderStage(order, now);
      if (!stage) {
        skippedNoStage += 1;
        continue;
      }

      if (existingReminderKeys.has(`${orderId}:${stage}`)) {
        skippedExisting += 1;
        continue;
      }

      eligible += 1;

      const lang = getLang(order.meta);
      const event = eventsById.get(eventId) || null;
      const fallbackKey = `${eventId}:${email.toLowerCase()}`;
      const fallbackRsvp = (rsvpsByEventEmail.get(fallbackKey) || [])[0] || null;
      const rsvp = rsvpByOrderId.get(orderId) || fallbackRsvp;
      const qrToken = String(rsvp?.qr_token || rsvp?.qr_code || '').trim();
      const attendees = normalizeAttendees(rsvp?.attendees, String(rsvp?.name || order.buyer_name || email));
      const expiresAt = String(order.reservation_expires_at || '').trim();
      const remainingHours = expiresAt ? Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now) / (60 * 60 * 1000))) : 0;
      const eventTitle = lang === 'en' && event?.title_en ? String(event.title_en) : String(event?.title || '');

      const enq = await enqueueEmailTrigger({
        triggerKey: 'rsvp_abandoned_cart',
        toEmail: email,
        lang,
        vars: {
          email,
          name: String(order.buyer_name || rsvp?.name || email),
          eventTitle,
          attendees,
          bankAccount,
          vs: String(order.variable_symbol || ''),
          dueDate: expiresAt,
          priceTotal: toNumber(rsvp?.price_total) || toNumber(order.total_amount),
          pricingLabel: String(rsvp?.pricing_label || ''),
          pricingLabelEn: String(rsvp?.pricing_label_en || ''),
          memberUrl: `${baseUrl}/${lang}/clen`,
          eventUrl: `${baseUrl}/${lang}/akce/${encodeURIComponent(eventId)}`,
          ticketPdfUrl: qrToken ? buildTicketPdfUrl(qrToken, lang) : '',
          remainingHours,
          stage,
        },
        meta: {
          kind: 'rsvp_abandoned_cart',
          event_order_id: orderId,
          event_id: eventId,
          rsvp_id: rsvp?.id ? String(rsvp.id) : null,
          stage,
        },
        headers: {
          'X-Pupen-Category': 'rsvp',
          'X-Pupen-Trigger': 'rsvp_abandoned_cart',
          'X-Pupen-Stage': stage,
        },
        supabase,
      });

      if (!enq.ok) {
        errors.push({ orderId, error: getErrorMessage('error' in enq ? enq.error : 'Queue error') });
        continue;
      }

      enqueued += 1;
      existingReminderKeys.add(`${orderId}:${stage}`);

      await supabase.from('admin_logs').insert([
        {
          admin_email: 'system',
          admin_name: 'RsvpRemindersCron',
          action: 'RSVP_ABANDONED_CART_REMINDER',
          target_id: orderId,
          details: {
            orderId,
            eventId,
            rsvpId: rsvp?.id ? String(rsvp.id) : null,
            email,
            stage,
            remainingHours,
            expiresAt: expiresAt || null,
            queueId: enq.queueId || null,
            at: new Date().toISOString(),
          },
        },
      ]);
    }

    return NextResponse.json({
      ok: true,
      scanned: orders.length,
      eligible,
      enqueued,
      skippedExisting,
      skippedNoStage,
      errors,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
