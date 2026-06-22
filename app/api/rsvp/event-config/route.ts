import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { normalizePriceRules, normalizeRegistrationFields, pickActivePriceRule } from '@/lib/rsvp/eventRegistration';

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(req: Request) {
  const supabase = getServerSupabase();

  try {
    const url = new URL(req.url);
    const eventId = asTrimmedString(url.searchParams.get('eventId'));
    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'EVENT_ID_REQUIRED' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const eventRes = await supabase
      .from('events')
      .select('id, published_at, archived_at, is_member_only, min_age, max_age')
      .eq('id', eventId)
      .maybeSingle();

    if (eventRes.error) {
      return NextResponse.json({ ok: false, error: 'EVENT_NOT_FOUND' }, { status: 404 });
    }

    const event = eventRes.data;
    if (!event || !event.published_at || event.published_at > nowIso || event.archived_at) {
      return NextResponse.json({ ok: false, error: 'EVENT_NOT_FOUND' }, { status: 404 });
    }
    if (event.is_member_only) {
      return NextResponse.json({ ok: false, error: 'EVENT_NOT_PUBLIC' }, { status: 403 });
    }

    let priceRules = [];
    try {
      const res = await supabase
        .from('event_price_rules')
        .select('id, sort_order, label, label_en, starts_at, ends_at, amount_czk, is_active')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('starts_at', { ascending: true });
      if (!res.error) priceRules = normalizePriceRules(res.data || []);
    } catch {}

    let registrationFields = [];
    try {
      const res = await supabase
        .from('event_registration_fields')
        .select('id, sort_order, field_key, field_type, label, label_en, placeholder, placeholder_en, helper_text, helper_text_en, options, is_required, is_active')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (!res.error) registrationFields = normalizeRegistrationFields(res.data || []);
    } catch {}

    const activePriceRule = pickActivePriceRule(priceRules);

    return NextResponse.json({
      ok: true,
      config: {
        minAge: event.min_age ?? null,
        maxAge: event.max_age ?? null,
        priceRules,
        registrationFields,
        activePriceRule,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'RSVP_EVENT_CONFIG_ERROR', message: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
