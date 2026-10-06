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

interface AdminLogRow {
  created_at?: string | null;
  details?: Record<string, unknown> | null;
}

const DEFAULT_CONFIG: DigestConfig = {
  enabled: false,
  timezone: 'Europe/Prague',
  dayOfWeek: 1,
  hour: 9,
  minute: 0,
  windowMinutes: 20,
  maxRecipients: 200,
  minIntervalHours: 72,
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeDigestConfig(input: unknown): DigestConfig {
  const config = toRecord(input);
  return {
    enabled: config.enabled === true,
    timezone: String(config.timezone || DEFAULT_CONFIG.timezone),
    dayOfWeek: Math.min(7, Math.max(1, Math.floor(Number(config.dayOfWeek || DEFAULT_CONFIG.dayOfWeek) || DEFAULT_CONFIG.dayOfWeek))),
    hour: Math.min(23, Math.max(0, Math.floor(Number(config.hour || DEFAULT_CONFIG.hour) || DEFAULT_CONFIG.hour))),
    minute: Math.min(59, Math.max(0, Math.floor(Number(config.minute || DEFAULT_CONFIG.minute) || DEFAULT_CONFIG.minute))),
    windowMinutes: Math.min(120, Math.max(5, Math.floor(Number(config.windowMinutes || DEFAULT_CONFIG.windowMinutes) || DEFAULT_CONFIG.windowMinutes))),
    maxRecipients: Math.min(2000, Math.max(1, Math.floor(Number(config.maxRecipients || DEFAULT_CONFIG.maxRecipients) || DEFAULT_CONFIG.maxRecipients))),
    minIntervalHours: Math.min(
      168,
      Math.max(1, Math.floor(Number(config.minIntervalHours || DEFAULT_CONFIG.minIntervalHours) || DEFAULT_CONFIG.minIntervalHours)),
    ),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

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
      .maybeSingle<AdminLogRow>();
    if (res.error) throw res.error;

    const config = normalizeDigestConfig(toRecord(res.data?.details).config);

    const last = await supabase
      .from('admin_logs')
      .select('created_at, details')
      .eq('action', 'DIGEST_SCHEDULED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<AdminLogRow>();
    if (last.error) throw last.error;

    return NextResponse.json({ ok: true, updatedAt: res.data?.created_at || null, config, lastScheduledAt: last.data?.created_at || null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
