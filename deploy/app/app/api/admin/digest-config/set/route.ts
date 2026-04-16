import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const input = body?.config || {};

    const config = {
      enabled: !!input.enabled,
      timezone: String(input.timezone || 'Europe/Prague'),
      dayOfWeek: Math.min(7, Math.max(1, Math.floor(num(input.dayOfWeek, 1)))),
      hour: Math.min(23, Math.max(0, Math.floor(num(input.hour, 9)))),
      minute: Math.min(59, Math.max(0, Math.floor(num(input.minute, 0)))),
      windowMinutes: Math.min(120, Math.max(5, Math.floor(num(input.windowMinutes, 20)))),
      maxRecipients: Math.min(2000, Math.max(1, Math.floor(num(input.maxRecipients, 200)))),
      minIntervalHours: Math.min(168, Math.max(1, Math.floor(num(input.minIntervalHours, 72)))),
    };

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'DigestConfig',
        action: 'DIGEST_CONFIG',
        target_id: null,
        details: { config, updatedAt: new Date().toISOString() },
      },
    ]);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

