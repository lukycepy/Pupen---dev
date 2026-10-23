export type NewsletterDoiConfig = {
  enabled: boolean;
  expiresHours: number;
};

export const DEFAULT_NEWSLETTER_DOI_CONFIG: NewsletterDoiConfig = {
  enabled: false,
  expiresHours: 72,
};

interface NewsletterDoiConfigLogRow {
  created_at?: string | null;
  details?: {
    config?: unknown;
  } | null;
}

interface AdminLogsQueryResult {
  data: NewsletterDoiConfigLogRow | null;
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

export function normalizeNewsletterDoiConfig(input: unknown): NewsletterDoiConfig {
  const i = toRecord(input);
  return {
    enabled: i.enabled === true,
    expiresHours: clampInt(i.expiresHours, 1, 14 * 24, DEFAULT_NEWSLETTER_DOI_CONFIG.expiresHours),
  };
}

export async function getNewsletterDoiConfigFromAdminLogs(
  supabase: unknown,
): Promise<{ config: NewsletterDoiConfig; updatedAt: string | null }> {
  const adminLogs = supabase as AdminLogsSupabaseLike;
  const res = await adminLogs
    .from('admin_logs')
    .select('created_at, details')
    .eq('action', 'NEWSLETTER_DOI_CONFIG')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw res.error;
  const cfg = res.data?.details?.config
    ? normalizeNewsletterDoiConfig(res.data.details.config)
    : DEFAULT_NEWSLETTER_DOI_CONFIG;
  return { config: cfg, updatedAt: res.data?.created_at || null };
}
