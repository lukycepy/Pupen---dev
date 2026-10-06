import { randomBytes } from 'crypto';
import { getPublicBaseUrl } from '@/lib/public-base-url';

type SupabaseLike = {
  from: (table: string) => any;
};

export type WaitlistOfferRow = {
  id?: string | null;
  event_id?: string | null;
  rsvp_id?: string | null;
  recipient_email?: string | null;
  attendees_count?: number | null;
  token?: string | null;
  status?: string | null;
  offered_at?: string | null;
  expires_at?: string | null;
  claimed_at?: string | null;
  cancelled_at?: string | null;
  meta?: Record<string, unknown> | null;
};

function hasMissingTableError(message: string) {
  return /waitlist_offers/i.test(message) && /(schema cache|does not exist|relation|column)/i.test(message);
}

function createOfferToken() {
  return randomBytes(24).toString('hex');
}

export function buildWaitlistOfferUrl(token: string, lang: 'cs' | 'en' = 'cs') {
  return `${getPublicBaseUrl()}/${lang}/waitlist/${encodeURIComponent(token)}`;
}

export async function loadActiveWaitlistOffers(supabase: SupabaseLike, eventId: string, now = new Date()) {
  try {
    const res = await supabase
      .from('waitlist_offers')
      .select('id, event_id, rsvp_id, recipient_email, attendees_count, token, status, offered_at, expires_at, claimed_at, cancelled_at, meta')
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .gt('expires_at', now.toISOString())
      .order('offered_at', { ascending: true });
    if (res.error) {
      if (hasMissingTableError(res.error.message)) return [];
      throw res.error;
    }
    return (res.data || []) as WaitlistOfferRow[];
  } catch (error) {
    if (error instanceof Error && hasMissingTableError(error.message)) return [];
    throw error;
  }
}

export async function createWaitlistOffer(
  supabase: SupabaseLike,
  input: {
    eventId: string;
    rsvpId: string;
    recipientEmail: string;
    attendeesCount: number;
    expiresAt: string;
    meta?: Record<string, unknown>;
  },
) {
  const token = createOfferToken();

  try {
    await supabase
      .from('waitlist_offers')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('rsvp_id', input.rsvpId)
      .eq('status', 'pending');
  } catch {}

  const res = await supabase
    .from('waitlist_offers')
    .insert([
      {
        event_id: input.eventId,
        rsvp_id: input.rsvpId,
        recipient_email: input.recipientEmail,
        attendees_count: Math.max(1, Math.floor(Number(input.attendeesCount || 1))),
        token,
        status: 'pending',
        offered_at: new Date().toISOString(),
        expires_at: input.expiresAt,
        meta: input.meta || {},
      },
    ])
    .select('id, token, expires_at')
    .single();

  if (res.error) {
    if (hasMissingTableError(res.error.message)) {
      return { id: null, token, expiresAt: input.expiresAt, url: buildWaitlistOfferUrl(token), persisted: false as const };
    }
    throw res.error;
  }

  return {
    id: res.data?.id ? String(res.data.id) : null,
    token: res.data?.token ? String(res.data.token) : token,
    expiresAt: res.data?.expires_at ? String(res.data.expires_at) : input.expiresAt,
    url: buildWaitlistOfferUrl(res.data?.token ? String(res.data.token) : token),
    persisted: true as const,
  };
}

export async function loadWaitlistOfferByToken(supabase: SupabaseLike, token: string) {
  const res = await supabase
    .from('waitlist_offers')
    .select('id, event_id, rsvp_id, recipient_email, attendees_count, token, status, offered_at, expires_at, claimed_at, cancelled_at, meta')
    .eq('token', token)
    .maybeSingle();

  if (res.error) {
    if (hasMissingTableError(res.error.message)) return null;
    throw res.error;
  }

  return (res.data || null) as WaitlistOfferRow | null;
}

export async function updateWaitlistOfferStatus(
  supabase: SupabaseLike,
  offerId: string,
  patch: {
    status: 'pending' | 'claimed' | 'expired' | 'cancelled';
    claimedAt?: string | null;
    cancelledAt?: string | null;
  },
) {
  const payload: Record<string, unknown> = {
    status: patch.status,
    claimed_at: patch.claimedAt ?? null,
    cancelled_at: patch.cancelledAt ?? null,
  };

  const res = await supabase.from('waitlist_offers').update(payload).eq('id', offerId);
  if (res.error && !hasMissingTableError(res.error.message)) throw res.error;
}

export async function expirePendingWaitlistOffers(supabase: SupabaseLike, now = new Date(), limit = 500) {
  try {
    const res = await supabase
      .from('waitlist_offers')
      .select('id, event_id, rsvp_id, recipient_email, attendees_count, token, status, offered_at, expires_at, claimed_at, cancelled_at, meta')
      .eq('status', 'pending')
      .lte('expires_at', now.toISOString())
      .order('expires_at', { ascending: true })
      .limit(limit);
    if (res.error) {
      if (hasMissingTableError(res.error.message)) return [];
      throw res.error;
    }

    const rows = (res.data || []) as WaitlistOfferRow[];
    for (const row of rows) {
      if (!row.id) continue;
      await updateWaitlistOfferStatus(supabase, String(row.id), { status: 'expired' }).catch(() => {});
    }
    return rows;
  } catch (error) {
    if (error instanceof Error && hasMissingTableError(error.message)) return [];
    throw error;
  }
}
