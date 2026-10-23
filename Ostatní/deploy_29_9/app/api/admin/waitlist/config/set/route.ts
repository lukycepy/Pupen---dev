import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { normalizeWaitlistConfig } from '@/lib/rsvp/waitlistConfig';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const config = normalizeWaitlistConfig(body.config);

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Waitlist',
        action: 'WAITLIST_CONFIG',
        target_id: null,
        details: { config, updatedAt: new Date().toISOString() },
      },
    ]);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
