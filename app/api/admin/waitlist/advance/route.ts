import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { getWaitlistConfigFromAdminLogs, DEFAULT_WAITLIST_CONFIG } from '@/lib/rsvp/waitlistConfig';
import { advanceWaitlistForEvent, type AdvanceWaitlistReason } from '@/lib/rsvp/waitlist';

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.eventId || '').trim();
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

    const rawReason = String(body?.reason || '').trim();
    const reason: AdvanceWaitlistReason =
      rawReason === 'cancel' || rawReason === 'capacity_increase' || rawReason === 'reservation_expiry' || rawReason === 'manual_admin'
        ? (rawReason as any)
        : 'manual_admin';

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
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

