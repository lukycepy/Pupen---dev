import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicGet, guardPublicPostAny } from '@/lib/public-post-guard';

function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
}

function normalizeReason(input: any) {
  const s = String(input || '').trim();
  return s.slice(0, 80);
}

function normalizeDetail(input: any) {
  const s = String(input || '').trim();
  return s.slice(0, 400);
}

function normalizeSmall(input: any) {
  const s = String(input || '').trim();
  return s.slice(0, 80);
}

function isMissingColumn(e: any) {
  const msg = String(e?.message || '');
  return /(schema cache|does not exist|column)/i.test(msg);
}

export async function GET(req: Request) {
  try {
    const g = await guardPublicGet(req, {
      keyPrefix: 'nl_unsub',
      windowMs: 10 * 60_000,
      max: 30,
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;

    const url = new URL(req.url);
    const email = normalizeEmail(url.searchParams.get('email') || '');
    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });
    const extras = {
      reason: normalizeReason(url.searchParams.get('reason') || ''),
      detail: normalizeDetail(url.searchParams.get('detail') || ''),
      source: normalizeSmall(url.searchParams.get('source') || ''),
      campaignId: normalizeSmall(url.searchParams.get('n') || ''),
      variant: normalizeSmall(url.searchParams.get('v') || ''),
    };

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();
    const payload: any = {
      consent: false,
      updated_at: nowIso,
      unsubscribed_at: nowIso,
      unsubscribe_reason: extras.reason || 'one_click',
      unsubscribe_reason_detail: extras.detail || null,
      unsubscribe_source: extras.source || 'email',
      unsubscribe_campaign_id: extras.campaignId || null,
      unsubscribe_variant: extras.variant || null,
    };

    let res: any = await supabase.from('newsletter_subscriptions').update(payload).eq('email', email);
    if (res.error && isMissingColumn(res.error)) {
      res = await supabase.from('newsletter_subscriptions').update({ consent: false, updated_at: nowIso }).eq('email', email);
    }

    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, status: 'unsubscribed' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicPostAny(req, {
      keyPrefix: 'nl_unsub',
      windowMs: 10 * 60_000,
      max: 30,
      honeypotResponse: { ok: true, status: 'unsubscribed' },
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const url = new URL(req.url);
    const email = normalizeEmail(url.searchParams.get('email') || body?.email || '');
    const fromQuery = {
      reason: normalizeReason(url.searchParams.get('reason') || ''),
      detail: normalizeDetail(url.searchParams.get('detail') || ''),
      source: normalizeSmall(url.searchParams.get('source') || ''),
      campaignId: normalizeSmall(url.searchParams.get('n') || ''),
      variant: normalizeSmall(url.searchParams.get('v') || ''),
    };
    const extras = {
      reason: normalizeReason(body?.reason || fromQuery.reason),
      detail: normalizeDetail(body?.detail || body?.reason_detail || fromQuery.detail),
      source: normalizeSmall(body?.source || fromQuery.source),
      campaignId: normalizeSmall(body?.campaignId || body?.campaign_id || fromQuery.campaignId),
      variant: normalizeSmall(body?.variant || fromQuery.variant),
    };

    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();
    const payload: any = {
      consent: false,
      updated_at: nowIso,
      unsubscribed_at: nowIso,
      unsubscribe_reason: extras.reason || 'manual',
      unsubscribe_reason_detail: extras.detail || null,
      unsubscribe_source: extras.source || 'web',
      unsubscribe_campaign_id: extras.campaignId || null,
      unsubscribe_variant: extras.variant || null,
    };

    let res: any = await supabase.from('newsletter_subscriptions').update(payload).eq('email', email);
    if (res.error && isMissingColumn(res.error)) {
      res = await supabase.from('newsletter_subscriptions').update({ consent: false, updated_at: nowIso }).eq('email', email);
    }

    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, status: 'unsubscribed' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
