import { getServerSupabase } from '@/lib/supabase-server';

interface CronConfigSecretRow {
  secret?: string | null;
}

function normalizeSecret(value: unknown) {
  return String(value || '').trim();
}

export function getCronSecretFromRequest(req: Request) {
  const url = new URL(req.url);
  return normalizeSecret(
    url.searchParams.get('secret') ||
      req.headers.get('x-cron-secret') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      '',
  );
}

async function getCronSecretFromDatabase() {
  try {
    const supabase = getServerSupabase();
    const res = await supabase.rpc('cron_config_get');
    if (res.error) return '';

    const row = Array.isArray(res.data) ? (res.data[0] as CronConfigSecretRow | undefined) : (res.data as CronConfigSecretRow | null);
    return normalizeSecret(row?.secret);
  } catch {
    return '';
  }
}

export async function requireCronRequest(req: Request) {
  const received = getCronSecretFromRequest(req);
  if (!received) return false;

  const envSecret = normalizeSecret(process.env.CRON_SECRET);
  if (envSecret && received === envSecret) return true;

  const dbSecret = await getCronSecretFromDatabase();
  if (dbSecret && received === dbSecret) return true;

  return false;
}
