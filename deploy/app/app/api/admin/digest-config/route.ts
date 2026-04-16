import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

const DEFAULT_CONFIG = {
  enabled: false,
  timezone: 'Europe/Prague',
  dayOfWeek: 1,
  hour: 9,
  minute: 0,
  windowMinutes: 20,
  maxRecipients: 200,
  minIntervalHours: 72,
};

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('admin_logs')
      .select('created_at, details')
      .eq('action', 'DIGEST_CONFIG')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw res.error;

    const cfg = res.data?.details?.config || null;
    const config = { ...DEFAULT_CONFIG, ...(cfg && typeof cfg === 'object' ? cfg : {}) };

    const last = await supabase
      .from('admin_logs')
      .select('created_at, details')
      .eq('action', 'DIGEST_SCHEDULED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) throw last.error;

    return NextResponse.json({ ok: true, updatedAt: res.data?.created_at || null, config, lastScheduledAt: last.data?.created_at || null });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

