import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { DEFAULT_WAITLIST_CONFIG, getWaitlistConfigFromAdminLogs } from '@/lib/rsvp/waitlistConfig';
import { advanceWaitlistForEvent } from '@/lib/rsvp/waitlist';
import { updateEventOrderStatus } from '@/lib/rsvp/orders';
import { updateWaitlistOfferStatus } from '@/lib/rsvp/waitlistOffers';

interface RsvpRow {
  id?: string | null;
  status?: string | null;
  expires_at?: string | null;
  checked_in?: boolean | null;
  event_order_id?: string | null;
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function normalizeToken(raw: unknown) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.startsWith('PUPEN-TICKET:')) return t.replace('PUPEN-TICKET:', '').trim();
  return t;
}

function normalizeEmail(input: unknown) {
  return String(input || '').trim().toLowerCase().slice(0, 240);
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'rsvp_cancel',
      windowMs: 5 * 60_000,
      max: 30,
      honeypotResponse: { ok: true, status: 'cancelled' },
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const eventId = asTrimmedString(body.eventId);
    const email = normalizeEmail(body.email);
    const token = normalizeToken(body.token || body.qrToken);
    if (!eventId || !email || !token) return NextResponse.json({ error: 'Missing eventId/email/token' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date();

    const loadRsvp = async (withOrderId: boolean) => {
      const select = withOrderId
        ? 'id, status, expires_at, checked_in, email, qr_code, qr_token, attendees, event_order_id'
        : 'id, status, expires_at, checked_in, email, qr_code, qr_token, attendees';
      return supabase
        .from('rsvp')
        .select(select)
        .eq('event_id', eventId)
        .eq('email', email)
        .or(`qr_code.eq.${token},qr_token.eq.${token}`)
        .maybeSingle();
    };
    let rsvpRes = await loadRsvp(true);
    if (rsvpRes.error && /event_order_id/i.test(rsvpRes.error.message) && /(schema cache|does not exist|column)/i.test(rsvpRes.error.message)) {
      rsvpRes = await loadRsvp(false);
    }
    if (rsvpRes.error) throw rsvpRes.error;
    const r = rsvpRes.data as RsvpRow | null;
    if (!r?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (r.status === 'cancelled') return NextResponse.json({ ok: true, status: 'already_cancelled' });
    if (r.checked_in) return NextResponse.json({ error: 'Already checked in' }, { status: 400 });
    if (r.expires_at && new Date(r.expires_at) <= now) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    let up = await supabase.from('rsvp').update({ status: 'cancelled', cancelled_at: now.toISOString() }).eq('id', r.id);
    if (up.error && /cancelled_at/i.test(up.error.message) && /(schema cache|does not exist|column)/i.test(up.error.message)) {
      up = await supabase.from('rsvp').update({ status: 'cancelled' }).eq('id', r.id);
    }
    if (up.error) throw up.error;

    if (r.event_order_id) {
      await updateEventOrderStatus(supabase, String(r.event_order_id), {
        status: 'cancelled',
        cancelledAt: now.toISOString(),
        reservationExpiresAt: null,
      }).catch(() => {});
    }

    try {
      const pendingOffers = await supabase.from('waitlist_offers').select('id').eq('rsvp_id', String(r.id)).eq('status', 'pending');
      if (!pendingOffers.error) {
        for (const offer of pendingOffers.data || []) {
          if (offer?.id) {
            await updateWaitlistOfferStatus(supabase, String(offer.id), {
              status: 'cancelled',
              cancelledAt: now.toISOString(),
            }).catch(() => {});
          }
        }
      }
    } catch {}

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: email,
          admin_name: 'PublicCancel',
          action: 'RSVP_CANCEL',
          target_id: String(eventId),
          details: { rsvpId: r.id, token, email, at: new Date().toISOString() },
        },
      ]);
    } catch {}

    try {
      const { config } = await getWaitlistConfigFromAdminLogs(supabase).catch(() => ({ config: DEFAULT_WAITLIST_CONFIG, updatedAt: null }));
      if (config.autoAdvanceOnCancel) {
        await advanceWaitlistForEvent({
          supabase,
          eventId,
          reason: 'cancel',
          config,
          actor: { email, name: 'PublicCancel' },
          now,
          lang: 'cs',
        });
      }
    } catch {}

    return NextResponse.json({ ok: true, status: 'cancelled' });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
