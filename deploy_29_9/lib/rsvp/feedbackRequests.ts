import { enqueueEmailTrigger } from '@/lib/email/triggers';
import { getPublicBaseUrl } from '@/lib/public-base-url';

type SupabaseClientLike = {
  from: (table: string) => any;
};

interface EventRow {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
  date?: string | null;
}

interface RsvpFeedbackRow {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  event_order_id?: string | null;
}

interface EventOrderMetaRow {
  id?: string | null;
  meta?: Record<string, unknown> | null;
}

interface AdminLogRow {
  details?: Record<string, unknown> | null;
}

export interface EnqueueEventFeedbackRequestsOptions {
  supabase: SupabaseClientLike;
  eventId: string;
  force?: boolean;
  actorEmail: string;
  actorName: string;
  source: 'admin' | 'cron';
}

export interface EnqueueEventFeedbackRequestsResult {
  ok: true;
  total: number;
  enqueued: number;
  skippedExisting: number;
  skippedMissingEmail: number;
}

function isMissingColumnError(message: string, feature: string) {
  return new RegExp(feature, 'i').test(message) && /(schema cache|does not exist|column|relation)/i.test(message);
}

export async function enqueueEventFeedbackRequests(
  opts: EnqueueEventFeedbackRequestsOptions,
): Promise<EnqueueEventFeedbackRequestsResult> {
  const { supabase, eventId, force = false, actorEmail, actorName, source } = opts;

  const eventRes = await supabase.from('events').select('id, title, title_en, date').eq('id', eventId).maybeSingle();
  if (eventRes.error) throw eventRes.error;
  const event = (eventRes.data as EventRow | null) || null;
  if (!event?.id) throw new Error('Event not found');

  const loadRsvps = async (withOrderId: boolean) => {
    const select = withOrderId ? 'id, email, name, event_order_id, checked_in, status' : 'id, email, name, checked_in, status';
    return supabase.from('rsvp').select(select).eq('event_id', eventId).eq('checked_in', true).neq('status', 'cancelled');
  };

  let rsvpRes = await loadRsvps(true);
  if (rsvpRes.error && isMissingColumnError(rsvpRes.error.message, 'event_order_id')) {
    rsvpRes = await loadRsvps(false);
  }
  if (rsvpRes.error) throw rsvpRes.error;

  const deduped = new Map<string, RsvpFeedbackRow>();
  for (const row of (rsvpRes.data || []) as RsvpFeedbackRow[]) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!email) continue;
    if (!deduped.has(email)) deduped.set(email, row);
  }
  const recipients = Array.from(deduped.values());
  if (!recipients.length) {
    return { ok: true, total: 0, enqueued: 0, skippedExisting: 0, skippedMissingEmail: 0 };
  }

  const orderIds = Array.from(new Set(recipients.map((row) => String(row.event_order_id || '')).filter(Boolean)));
  const langByOrderId = new Map<string, 'cs' | 'en'>();
  if (orderIds.length) {
    const ordersRes = await supabase.from('event_orders').select('id, meta').in('id', orderIds);
    if (!ordersRes.error) {
      for (const row of (ordersRes.data || []) as EventOrderMetaRow[]) {
        const orderId = String(row.id || '');
        if (!orderId) continue;
        langByOrderId.set(orderId, row.meta?.lang === 'en' ? 'en' : 'cs');
      }
    }
  }

  const existingEmails = new Set<string>();
  if (!force) {
    const logsRes = await supabase
      .from('admin_logs')
      .select('details')
      .eq('action', 'EVENT_FEEDBACK_REQUEST_SENT')
      .eq('target_id', eventId)
      .limit(5000);
    if (!logsRes.error) {
      for (const row of (logsRes.data || []) as AdminLogRow[]) {
        const email = String(row.details?.email || '').trim().toLowerCase();
        if (email) existingEmails.add(email);
      }
    }
  }

  const baseUrl = getPublicBaseUrl();
  let enqueued = 0;
  let skippedExisting = 0;
  let skippedMissingEmail = 0;

  for (const row of recipients) {
    const email = String(row.email || '').trim();
    if (!email) {
      skippedMissingEmail += 1;
      continue;
    }

    const emailKey = email.toLowerCase();
    if (!force && existingEmails.has(emailKey)) {
      skippedExisting += 1;
      continue;
    }

    const lang = langByOrderId.get(String(row.event_order_id || '')) || 'cs';
    const eventTitle = lang === 'en' && event.title_en ? String(event.title_en) : String(event.title || '');
    const feedbackUrl = `${baseUrl}/${lang}/feedback/${encodeURIComponent(eventId)}`;

    const enq = await enqueueEmailTrigger({
      triggerKey: 'event_feedback_request',
      toEmail: email,
      lang,
      vars: {
        email,
        name: String(row.name || email),
        eventTitle,
        eventDate: String(event.date || ''),
        feedbackUrl,
      },
      meta: {
        kind: 'event_feedback_request',
        event_id: eventId,
        rsvp_id: row.id ? String(row.id) : null,
        source,
      },
      headers: {
        'X-Pupen-Category': 'events',
        'X-Pupen-Trigger': 'event_feedback_request',
      },
      supabase: supabase as any,
    });

    if (!enq.ok) continue;

    enqueued += 1;
    existingEmails.add(emailKey);

    await supabase.from('admin_logs').insert([
      {
        admin_email: actorEmail,
        admin_name: actorName,
        action: 'EVENT_FEEDBACK_REQUEST_SENT',
        target_id: eventId,
        details: {
          eventId,
          rsvpId: row.id ? String(row.id) : null,
          email,
          lang,
          queueId: enq.queueId || null,
          source,
          at: new Date().toISOString(),
        },
      },
    ]);
  }

  return {
    ok: true,
    total: recipients.length,
    enqueued,
    skippedExisting,
    skippedMissingEmail,
  };
}
