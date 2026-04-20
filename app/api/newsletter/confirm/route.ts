import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicGet } from '@/lib/public-post-guard';
import { DEFAULT_NEWSLETTER_DOI_CONFIG, getNewsletterDoiConfigFromAdminLogs } from '@/lib/newsletter/doiConfig';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeLang(input: any) {
  return String(input || '').trim() === 'en' ? 'en' : 'cs';
}

export async function GET(req: Request) {
  try {
    const g = await guardPublicGet(req, {
      keyPrefix: 'nl_doi_confirm',
      windowMs: 10 * 60_000,
      max: 60,
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;

    const url = new URL(req.url);
    const token = String(url.searchParams.get('token') || '').trim();
    const lang = normalizeLang(url.searchParams.get('lang') || 'cs');
    const home = new URL(`/${lang}`, url.origin);

    if (!token || token.length < 24) {
      home.searchParams.set('newsletter', 'invalid');
      return NextResponse.redirect(home);
    }

    const supabase = getServerSupabase();
    const { config } = await getNewsletterDoiConfigFromAdminLogs(supabase).catch(() => ({ config: DEFAULT_NEWSLETTER_DOI_CONFIG, updatedAt: null }));
    if (!config.enabled) {
      home.searchParams.set('newsletter', 'disabled');
      return NextResponse.redirect(home);
    }

    const tokenHash = sha256Hex(token);
    const rowRes = await supabase
      .from('newsletter_subscriptions')
      .select('id, email, doi_requested_at, consent, unsubscribed_at')
      .eq('doi_token_hash', tokenHash)
      .maybeSingle();
    if (rowRes.error) throw rowRes.error;
    const row: any = rowRes.data;
    if (!row?.id) {
      home.searchParams.set('newsletter', 'invalid');
      return NextResponse.redirect(home);
    }

    const requestedAt = row.doi_requested_at ? Date.parse(String(row.doi_requested_at)) : 0;
    const expiresMs = Number(config.expiresHours || DEFAULT_NEWSLETTER_DOI_CONFIG.expiresHours) * 60 * 60 * 1000;
    if (!requestedAt || Number.isNaN(requestedAt) || Date.now() > requestedAt + expiresMs) {
      home.searchParams.set('newsletter', 'expired');
      return NextResponse.redirect(home);
    }

    const nowIso = new Date().toISOString();
    const upd = await supabase
      .from('newsletter_subscriptions')
      .update({
        consent: true,
        doi_confirmed_at: nowIso,
        doi_requested_at: null,
        doi_token_hash: null,
        updated_at: nowIso,
        unsubscribed_at: null,
        unsubscribe_reason: null,
        unsubscribe_reason_detail: null,
        unsubscribe_source: null,
        unsubscribe_campaign_id: null,
        unsubscribe_variant: null,
      })
      .eq('id', row.id);

    if (upd.error) {
      const alt = await supabase
        .from('newsletter_subscriptions')
        .update({ consent: true, updated_at: nowIso })
        .eq('id', row.id);
      if (alt.error) throw alt.error;
    }

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: row.email || 'unknown',
          admin_name: 'NewsletterDOI',
          action: 'NEWSLETTER_DOI_CONFIRMED',
          target_id: String(row.id),
          details: { email: row.email || null, at: nowIso },
        },
      ]);
    } catch {}

    home.searchParams.set('newsletter', 'confirmed');
    return NextResponse.redirect(home);
  } catch {
    const url = new URL(req.url);
    const home = new URL(`/cs`, url.origin);
    home.searchParams.set('newsletter', 'error');
    return NextResponse.redirect(home);
  }
}
