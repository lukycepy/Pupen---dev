import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { DEFAULT_WAITLIST_CONFIG, getWaitlistConfigFromAdminLogs } from '@/lib/rsvp/waitlistConfig';
import { advanceWaitlistForEvent } from '@/lib/rsvp/waitlist';

function normalizeToken(raw: string) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.startsWith('PUPEN-TICKET:')) return t.replace('PUPEN-TICKET:', '').trim();
  return t;
}

function normalizeEmail(input: string) {
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
    const body = g.body || {};

    const eventId = String(body?.eventId || '').trim();
    const email = normalizeEmail(body?.email || '');
    const token = normalizeToken(body?.token || body?.qrToken || '');
    if (!eventId || !email || !token) return NextResponse.json({ error: 'Missing eventId/email/token' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date();

    const rsvpRes = await supabase
      .from('rsvp')
      .select('id, status, expires_at, checked_in, email, qr_code, qr_token, attendees')
      .eq('event_id', eventId)
      .eq('email', email)
      .or(`qr_code.eq.${token},qr_token.eq.${token}`)
      .maybeSingle();
    if (rsvpRes.error) throw rsvpRes.error;
    const r: any = rsvpRes.data;
    if (!r?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (r.status === 'cancelled') return NextResponse.json({ ok: true, status: 'already_cancelled' });
    if (r.checked_in) return NextResponse.json({ error: 'Already checked in' }, { status: 400 });
    if (r.expires_at && new Date(r.expires_at) <= now) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    const up = await supabase.from('rsvp').update({ status: 'cancelled' }).eq('id', r.id);
    if (up.error) throw up.error;

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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
