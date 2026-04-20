export type NewsletterDoiConfig = {
  enabled: boolean;
  expiresHours: number;
};

export const DEFAULT_NEWSLETTER_DOI_CONFIG: NewsletterDoiConfig = {
  enabled: false,
  expiresHours: 72,
};

function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  const v = Math.trunc(x);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function normalizeNewsletterDoiConfig(input: any): NewsletterDoiConfig {
  const i = input && typeof input === 'object' ? input : {};
  return {
    enabled: i.enabled === true,
    expiresHours: clampInt(i.expiresHours, 1, 14 * 24, DEFAULT_NEWSLETTER_DOI_CONFIG.expiresHours),
  };
}

export async function getNewsletterDoiConfigFromAdminLogs(supabase: any): Promise<{ config: NewsletterDoiConfig; updatedAt: string | null }> {
  const res = await supabase
    .from('admin_logs')
    .select('created_at, details')
    .eq('action', 'NEWSLETTER_DOI_CONFIG')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw res.error;
  const cfg = res.data?.details?.config ? normalizeNewsletterDoiConfig(res.data.details.config) : DEFAULT_NEWSLETTER_DOI_CONFIG;
  return { config: cfg, updatedAt: res.data?.created_at || null };
}

