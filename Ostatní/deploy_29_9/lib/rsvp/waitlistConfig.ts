export type WaitlistGroupHandling = 'skip_non_fit' | 'block_on_non_fit';

export type WaitlistConfig = {
  enabled: boolean;
  strategy: 'fifo';
  groupHandling: WaitlistGroupHandling;
  reservationExpiresHours: number;
  notifyOnPromotion: boolean;
  autoAdvanceOnCancel: boolean;
  autoAdvanceOnCapacityIncrease: boolean;
  autoAdvanceOnReservationExpiry: boolean;
  maxPromotionsPerRun: number;
};

export const DEFAULT_WAITLIST_CONFIG: WaitlistConfig = {
  enabled: true,
  strategy: 'fifo',
  groupHandling: 'skip_non_fit',
  reservationExpiresHours: 24,
  notifyOnPromotion: true,
  autoAdvanceOnCancel: true,
  autoAdvanceOnCapacityIncrease: true,
  autoAdvanceOnReservationExpiry: true,
  maxPromotionsPerRun: 25,
};

interface WaitlistConfigLogRow {
  created_at?: string | null;
  details?: {
    config?: unknown;
  } | null;
}

interface AdminLogsQueryResult {
  data: WaitlistConfigLogRow | null;
  error: Error | null;
}

interface AdminLogsQuery {
  eq(column: string, value: string): {
    order(column: string, options: { ascending: boolean }): {
      limit(value: number): {
        maybeSingle(): PromiseLike<AdminLogsQueryResult>;
      };
    };
  };
}

interface AdminLogsSupabaseLike {
  from(table: 'admin_logs'): {
    select(columns: string): AdminLogsQuery;
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  const v = Math.trunc(x);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function normalizeWaitlistConfig(input: unknown): WaitlistConfig {
  const i = toRecord(input);

  const enabled = i.enabled !== false;
  const strategy = 'fifo' as const;
  const groupHandling: WaitlistGroupHandling =
    i.groupHandling === 'block_on_non_fit' ? 'block_on_non_fit' : 'skip_non_fit';

  const reservationExpiresHours = clampInt(i.reservationExpiresHours, 1, 14 * 24, DEFAULT_WAITLIST_CONFIG.reservationExpiresHours);
  const maxPromotionsPerRun = clampInt(i.maxPromotionsPerRun, 1, 200, DEFAULT_WAITLIST_CONFIG.maxPromotionsPerRun);

  const notifyOnPromotion = i.notifyOnPromotion !== false;
  const autoAdvanceOnCancel = i.autoAdvanceOnCancel !== false;
  const autoAdvanceOnCapacityIncrease = i.autoAdvanceOnCapacityIncrease !== false;
  const autoAdvanceOnReservationExpiry = i.autoAdvanceOnReservationExpiry !== false;

  return {
    enabled,
    strategy,
    groupHandling,
    reservationExpiresHours,
    notifyOnPromotion,
    autoAdvanceOnCancel,
    autoAdvanceOnCapacityIncrease,
    autoAdvanceOnReservationExpiry,
    maxPromotionsPerRun,
  };
}

export async function getWaitlistConfigFromAdminLogs(
  supabase: unknown,
): Promise<{ config: WaitlistConfig; updatedAt: string | null }> {
  const adminLogs = supabase as AdminLogsSupabaseLike;
  const res = await adminLogs
    .from('admin_logs')
    .select('created_at, details')
    .eq('action', 'WAITLIST_CONFIG')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw res.error;
  const cfg = res.data?.details?.config ? normalizeWaitlistConfig(res.data.details.config) : DEFAULT_WAITLIST_CONFIG;
  return { config: cfg, updatedAt: res.data?.created_at || null };
}
