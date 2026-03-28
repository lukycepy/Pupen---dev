import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

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

async function extractEmail(req: Request) {
  const { searchParams } = new URL(req.url);
  const fromQuery = normalizeEmail(searchParams.get('email') || '');
  if (fromQuery) return fromQuery;

  const ct = String(req.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return normalizeEmail(body?.email || '');
  }

  const raw = await req.text().catch(() => '');
  const sp = new URLSearchParams(raw);
  const fromForm = normalizeEmail(sp.get('email') || '');
  if (fromForm) return fromForm;

  return '';
}

async function extractExtras(req: Request) {
  const { searchParams } = new URL(req.url);
  const fromQuery = {
    reason: normalizeReason(searchParams.get('reason') || ''),
    detail: normalizeDetail(searchParams.get('detail') || ''),
    source: normalizeSmall(searchParams.get('source') || ''),
    campaignId: normalizeSmall(searchParams.get('n') || ''),
    variant: normalizeSmall(searchParams.get('v') || ''),
  };

  const ct = String(req.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return {
      reason: normalizeReason(body?.reason || fromQuery.reason),
      detail: normalizeDetail(body?.detail || body?.reason_detail || fromQuery.detail),
      source: normalizeSmall(body?.source || fromQuery.source),
      campaignId: normalizeSmall(body?.campaignId || body?.campaign_id || fromQuery.campaignId),
      variant: normalizeSmall(body?.variant || fromQuery.variant),
    };
  }

  const raw = await req.text().catch(() => '');
  const sp = new URLSearchParams(raw);
  return {
    reason: normalizeReason(sp.get('reason') || fromQuery.reason),
    detail: normalizeDetail(sp.get('detail') || fromQuery.detail),
    source: normalizeSmall(sp.get('source') || fromQuery.source),
    campaignId: normalizeSmall(sp.get('n') || fromQuery.campaignId),
    variant: normalizeSmall(sp.get('v') || fromQuery.variant),
  };
}

function isMissingColumn(e: any) {
  const msg = String(e?.message || '');
  return /(schema cache|does not exist|column)/i.test(msg);
}

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `nl_unsub:${ip}`, windowMs: 10 * 60_000, max: 30 });
    if (!rl.ok) return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to později.' }, { status: 429 });

    const email = await extractEmail(req);
    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });
    const extras = await extractExtras(req);

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
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `nl_unsub:${ip}`, windowMs: 10 * 60_000, max: 30 });
    if (!rl.ok) return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to později.' }, { status: 429 });

    const email = await extractEmail(req);
    const extras = await extractExtras(req);

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
