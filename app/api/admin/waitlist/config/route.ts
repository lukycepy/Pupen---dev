import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { DEFAULT_WAITLIST_CONFIG, getWaitlistConfigFromAdminLogs } from '@/lib/rsvp/waitlistConfig';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const { config, updatedAt } = await getWaitlistConfigFromAdminLogs(supabase).catch(() => ({
      config: DEFAULT_WAITLIST_CONFIG,
      updatedAt: null,
    }));
    return NextResponse.json({ ok: true, updatedAt, config });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

