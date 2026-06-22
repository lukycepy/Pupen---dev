import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface DigestConfig {
  enabled: boolean;
  timezone: string;
  dayOfWeek: number;
  hour: number;
  minute: number;
  windowMinutes: number;
  maxRecipients: number;
  minIntervalHours: number;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function num(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input = toRecord(body.config);

    const config: DigestConfig = {
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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
