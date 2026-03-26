import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

function normalizeToken(raw: string) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.startsWith('PUPEN-TICKET:')) return t.replace('PUPEN-TICKET:', '').trim();
  return t;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.eventId || body?.event_id || '').trim();
    const rsvpId = String(body?.rsvpId || body?.rsvp_id || '').trim();
    const token = normalizeToken(body?.token || body?.qr || '');
    const checkedIn = body?.checkedIn === false ? false : true;
    const source = body?.source ? String(body.source).slice(0, 40) : null;

    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    if (!rsvpId && !token) return NextResponse.json({ error: 'Missing rsvpId/token' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date();

    const rsvpRes = rsvpId
      ? await supabase
          .from('rsvp')
          .select('id, event_id, status, expires_at, checked_in, checked_in_at, qr_code, qr_token, email, name')
          .eq('id', rsvpId)
          .eq('event_id', eventId)
          .maybeSingle()
      : await supabase
          .from('rsvp')
          .select('id, event_id, status, expires_at, checked_in, checked_in_at, qr_code, qr_token, email, name')
          .eq('event_id', eventId)
          .or(`qr_code.eq.${token},qr_token.eq.${token}`)
          .maybeSingle();

    if (rsvpRes.error) throw rsvpRes.error;
    const r: any = rsvpRes.data;
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (r.status === 'cancelled') return NextResponse.json({ error: 'Cancelled' }, { status: 400 });
    if (r.expires_at && new Date(r.expires_at) <= now) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    if (checkedIn) {
      if (r.checked_in) return NextResponse.json({ ok: true, status: 'already_checked_in', rsvpId: r.id });

      const ins = await supabase
        .from('rsvp_checkins')
        .upsert(
          [
            {
              event_id: eventId,
              rsvp_id: r.id,
              checked_in_at: now.toISOString(),
              checked_in_by_email: user.email || 'admin',
              source,
              raw: { token, by: user.email || null },
            },
          ],
          { onConflict: 'event_id,rsvp_id', ignoreDuplicates: true },
        )
        .select('id')
        .maybeSingle();
      if (ins.error) throw ins.error;

      await supabase.from('rsvp').update({ checked_in: true, checked_in_at: now.toISOString() }).eq('id', r.id);

      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: 'CheckIn',
          action: 'TICKET_CHECKIN',
          target_id: String(eventId),
          details: { rsvpId: r.id, token: token || r.qr_code || r.qr_token || null, email: r.email || null, name: r.name || null },
        },
      ]);

      return NextResponse.json({ ok: true, status: 'checked_in', rsvpId: r.id });
    }

    if (!r.checked_in) return NextResponse.json({ ok: true, status: 'already_not_checked_in', rsvpId: r.id });

    await supabase.from('rsvp_checkins').delete().eq('event_id', eventId).eq('rsvp_id', r.id);
    await supabase.from('rsvp').update({ checked_in: false }).eq('id', r.id);

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'CheckIn',
        action: 'TICKET_CHECKIN_UNDO',
        target_id: String(eventId),
        details: { rsvpId: r.id, token: token || r.qr_code || r.qr_token || null, email: r.email || null, name: r.name || null },
      },
    ]);

    return NextResponse.json({ ok: true, status: 'unchecked', rsvpId: r.id });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

