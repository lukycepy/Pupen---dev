import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { DEFAULT_WAITLIST_CONFIG, getWaitlistConfigFromAdminLogs } from '@/lib/rsvp/waitlistConfig';
import { advanceWaitlistForEvent } from '@/lib/rsvp/waitlist';

export const runtime = 'nodejs';

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

  const expRes = await supabase
    .from('rsvp')
    .select('id,event_id,email,expires_at,attendees')
    .eq('status', 'reserved')
    .not('expires_at', 'is', null)
    .lte('expires_at', now.toISOString())
    .order('expires_at', { ascending: true })
    .limit(limit);
  if (expRes.error) return NextResponse.json({ error: expRes.error.message }, { status: 500 });

  const rows: any[] = expRes.data || [];
  if (!rows.length) return NextResponse.json({ ok: true, expiredCancelled: 0, advancedEvents: 0, promoted: 0 });

  const eventIds = new Set<string>();
  let expiredCancelled = 0;

  for (const r of rows) {
    const id = String(r.id || '');
    const eventId = String(r.event_id || '');
    if (!id || !eventId) continue;
    eventIds.add(eventId);

    const up = await supabase.from('rsvp').update({ status: 'cancelled' }).eq('id', id);
    if (up.error) continue;
    expiredCancelled += 1;

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
      if ((res as any)?.promoted) promoted += Number((res as any).promoted) || 0;
      advancedEvents += 1;
    } catch {}
  }

  return NextResponse.json({ ok: true, expiredCancelled, advancedEvents, promoted });
}

