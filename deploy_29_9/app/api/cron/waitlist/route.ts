import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { DEFAULT_WAITLIST_CONFIG, getWaitlistConfigFromAdminLogs } from '@/lib/rsvp/waitlistConfig';
import { advanceWaitlistForEvent } from '@/lib/rsvp/waitlist';
import { updateEventOrderStatus } from '@/lib/rsvp/orders';
import { expirePendingWaitlistOffers } from '@/lib/rsvp/waitlistOffers';

export const runtime = 'nodejs';

interface WaitlistReservationRow {
  id?: string | null;
  event_id?: string | null;
  email?: string | null;
  expires_at?: string | null;
  attendees?: unknown;
  event_order_id?: string | null;
}

interface WaitlistAdvanceResult {
  promoted?: number;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
  const supabase = getServerSupabase();
  const now = new Date();

  const { config } = await getWaitlistConfigFromAdminLogs(supabase).catch(() => ({ config: DEFAULT_WAITLIST_CONFIG, updatedAt: null }));
  if (!config.autoAdvanceOnReservationExpiry) return NextResponse.json({ ok: true, expiredCancelled: 0, advancedEvents: 0, promoted: 0, disabled: true });

  const eventIds = new Set<string>();
  const expiredOffers = await expirePendingWaitlistOffers(supabase, now, limit).catch(() => []);
  for (const offer of expiredOffers) {
    const eventId = String(offer.event_id || '');
    if (!eventId) continue;
    eventIds.add(eventId);
    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: 'system',
          admin_name: 'WaitlistCron',
          action: 'WAITLIST_OFFER_EXPIRED',
          target_id: eventId,
          details: {
            offerId: String(offer.id || ''),
            rsvpId: String(offer.rsvp_id || ''),
            email: String(offer.recipient_email || ''),
            expiresAt: offer.expires_at || null,
            at: now.toISOString(),
          },
        },
      ]);
    } catch {}
  }

  const loadExpired = async (withOrderId: boolean) => {
    const select = withOrderId
      ? 'id,event_id,email,expires_at,attendees,event_order_id'
      : 'id,event_id,email,expires_at,attendees';
    return supabase
      .from('rsvp')
      .select(select)
      .eq('status', 'reserved')
      .not('expires_at', 'is', null)
      .lte('expires_at', now.toISOString())
      .order('expires_at', { ascending: true })
      .limit(limit);
  };
  let expRes = await loadExpired(true);
  if (expRes.error && /event_order_id/i.test(expRes.error.message) && /(schema cache|does not exist|column)/i.test(expRes.error.message)) {
    expRes = await loadExpired(false);
  }
  if (expRes.error) return NextResponse.json({ error: expRes.error.message }, { status: 500 });

  const rows = (expRes.data || []) as WaitlistReservationRow[];
  if (!rows.length && !expiredOffers.length) return NextResponse.json({ ok: true, expiredCancelled: 0, expiredOffers: 0, advancedEvents: 0, promoted: 0 });

  let expiredCancelled = 0;

  for (const r of rows) {
    const id = String(r.id || '');
    const eventId = String(r.event_id || '');
    if (!id || !eventId) continue;
    eventIds.add(eventId);

    let up = await supabase.from('rsvp').update({ status: 'cancelled', cancelled_at: now.toISOString() }).eq('id', id);
    if (up.error && /cancelled_at/i.test(up.error.message) && /(schema cache|does not exist|column)/i.test(up.error.message)) {
      up = await supabase.from('rsvp').update({ status: 'cancelled' }).eq('id', id);
    }
    if (up.error) continue;
    expiredCancelled += 1;

    if (r.event_order_id) {
      await updateEventOrderStatus(supabase, String(r.event_order_id), {
        status: 'cancelled',
        cancelledAt: now.toISOString(),
        reservationExpiresAt: null,
      }).catch(() => {});
    }

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: 'system',
          admin_name: 'WaitlistCron',
          action: 'RSVP_RESERVATION_EXPIRED',
          target_id: eventId,
          details: { rsvpId: id, email: String(r.email || ''), expiresAt: r.expires_at || null, at: now.toISOString() },
        },
      ]);
    } catch {}
  }

  let promoted = 0;
  let advancedEvents = 0;
  for (const eventId of eventIds) {
    try {
      const res = await advanceWaitlistForEvent({
        supabase,
        eventId,
        reason: 'reservation_expiry',
        config,
        actor: { email: 'system', name: 'WaitlistCron' },
        now,
        lang: 'cs',
      });
      const advanceResult = res as WaitlistAdvanceResult;
      if (advanceResult.promoted) promoted += Number(advanceResult.promoted) || 0;
      advancedEvents += 1;
    } catch {}
  }

  return NextResponse.json({ ok: true, expiredCancelled, expiredOffers: expiredOffers.length, advancedEvents, promoted });
}
