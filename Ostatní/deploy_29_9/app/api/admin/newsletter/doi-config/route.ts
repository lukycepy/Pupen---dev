import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { DEFAULT_NEWSLETTER_DOI_CONFIG, getNewsletterDoiConfigFromAdminLogs } from '@/lib/newsletter/doiConfig';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const { config, updatedAt } = await getNewsletterDoiConfigFromAdminLogs(supabase).catch(() => ({
      config: DEFAULT_NEWSLETTER_DOI_CONFIG,
      updatedAt: null,
    }));
    return NextResponse.json({ ok: true, updatedAt, config });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
