import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { DEFAULT_WAITLIST_CONFIG, getWaitlistConfigFromAdminLogs } from '@/lib/rsvp/waitlistConfig';
import { DEFAULT_NEWSLETTER_DOI_CONFIG, getNewsletterDoiConfigFromAdminLogs } from '@/lib/newsletter/doiConfig';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();

  const out: any = { ok: true, checks: {} };

  try {
    const { config, updatedAt } = await getWaitlistConfigFromAdminLogs(supabase).catch(() => ({
      config: DEFAULT_WAITLIST_CONFIG,
      updatedAt: null,
    }));
    out.checks.waitlistConfig = { ok: true, updatedAt, enabled: config.enabled !== false };
  } catch (e: any) {
    out.checks.waitlistConfig = { ok: false, error: String(e?.message || e) };
    out.ok = false;
  }

  try {
    const { config, updatedAt } = await getNewsletterDoiConfigFromAdminLogs(supabase).catch(() => ({
      config: DEFAULT_NEWSLETTER_DOI_CONFIG,
      updatedAt: null,
    }));
    out.checks.newsletterDoi = { ok: true, updatedAt, enabled: config.enabled === true };
  } catch (e: any) {
    out.checks.newsletterDoi = { ok: false, error: String(e?.message || e) };
    out.ok = false;
  }

  try {
    const rsvp = await supabase.from('rsvp').select('id', { count: 'exact', head: true }).limit(1);
    if (rsvp.error) throw rsvp.error;
    out.checks.rsvpTable = { ok: true, count: typeof rsvp.count === 'number' ? rsvp.count : null };
  } catch (e: any) {
    out.checks.rsvpTable = { ok: false, error: String(e?.message || e) };
    out.ok = false;
  }

  try {
    const subs = await supabase.from('newsletter_subscriptions').select('id', { count: 'exact', head: true }).limit(1);
    if (subs.error) throw subs.error;
    out.checks.newsletterSubscriptionsTable = { ok: true, count: typeof subs.count === 'number' ? subs.count : null };
  } catch (e: any) {
    out.checks.newsletterSubscriptionsTable = { ok: false, error: String(e?.message || e) };
    out.ok = false;
  }

  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}

