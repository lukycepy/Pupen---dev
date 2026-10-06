import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { getWaitlistConfigFromAdminLogs, DEFAULT_WAITLIST_CONFIG } from '@/lib/rsvp/waitlistConfig';
import { advanceWaitlistForEvent, type AdvanceWaitlistReason } from '@/lib/rsvp/waitlist';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function isAdvanceWaitlistReason(value: string): value is AdvanceWaitlistReason {
  return value === 'cancel' || value === 'capacity_increase' || value === 'reservation_expiry' || value === 'manual_admin' || value === 'unknown';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const eventId = String(body.eventId || '').trim();
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

    const rawReason = String(body.reason || '').trim();
    const reason: AdvanceWaitlistReason = isAdvanceWaitlistReason(rawReason) ? rawReason : 'manual_admin';

    const supabase = getServerSupabase();
    const { config } = await getWaitlistConfigFromAdminLogs(supabase).catch(() => ({ config: DEFAULT_WAITLIST_CONFIG, updatedAt: null }));

    const result = await advanceWaitlistForEvent({
      supabase,
      eventId,
      reason,
      config,
      actor: { email: user.email || 'admin', name: 'AdminWaitlist' },
      lang: 'cs',
    });

    return NextResponse.json({ ok: true, result });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
