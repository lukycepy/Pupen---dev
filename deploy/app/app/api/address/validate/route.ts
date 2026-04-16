import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

function pickFirst(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function formatLabel(addr: any) {
  const street = pickFirst(addr, ['road', 'pedestrian', 'footway', 'street']);
  const house = pickFirst(addr, ['house_number']);
  const postcode = pickFirst(addr, ['postcode']);
  const city = pickFirst(addr, ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb']);

  const a = [street, house].filter(Boolean).join(' ');
  const b = [postcode, city].filter(Boolean).join(' ');
  return [a, b].filter(Boolean).join(', ');
}

function formatFull(addr: any) {
  const street = pickFirst(addr, ['road', 'pedestrian', 'footway', 'street']);
  const house = pickFirst(addr, ['house_number']);
  const postcode = pickFirst(addr, ['postcode']);
  const city = pickFirst(addr, ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb']);
  const parts = [street, house, postcode, city].filter(Boolean);
  return parts.join(', ');
}

async function getAddressProvider() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('site_public_config').select('member_portal').eq('id', 1).maybeSingle();
    if (error) return 'nominatim';
    const mp: any = data?.member_portal && typeof data.member_portal === 'object' ? data.member_portal : {};
    const v = String(mp?.address_provider || '').trim().toLowerCase();
    return v === 'ruian' ? 'ruian' : 'nominatim';
  } catch {
    return 'nominatim';
  }
}

async function validateNominatim(q: string, lang: string) {
  const qs = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'cz',
    dedupe: '1',
    q,
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs.toString()}`, {
    headers: {
      'User-Agent': 'Pupen/1.0 (info@pupen.org)',
      'Accept-Language': lang === 'en' ? 'en' : 'cs',
    },
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false };
  const data = (await res.json().catch(() => [])) as any[];
  const x = Array.isArray(data) ? data[0] : null;
  if (!x) return { ok: false };
  const addr = x?.address || {};
  const label = formatLabel(addr) || String(x?.display_name || '').trim();
  const full = formatFull(addr) || String(x?.display_name || '').trim();
  const city = pickFirst(addr, ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb']);
  const postcode = pickFirst(addr, ['postcode']);
  const street = pickFirst(addr, ['road', 'pedestrian', 'footway', 'street']);
  const house_number = pickFirst(addr, ['house_number']);

  const strictOk = !!(city && postcode);
  return {
    ok: strictOk,
    provider: 'nominatim',
    id: String(x?.place_id || ''),
    label,
    full,
    city,
    postcode,
    street,
    house_number,
    lat: x?.lat ? Number(x.lat) : null,
    lon: x?.lon ? Number(x.lon) : null,
  };
}

async function validateRuian(q: string) {
  const base = 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Vyhledavaci_sluzba_nad_daty_RUIAN/MapServer/exts/GeocodeSOE/findAddressCandidates';
  const qs = new URLSearchParams({
    SingleLine: q,
    maxLocations: '1',
    outFields: 'Match_addr,Score',
    f: 'pjson',
  });
  const res = await fetch(`${base}?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) return { ok: false };
  const json: any = await res.json().catch(() => ({}));
  const c = Array.isArray(json?.candidates) ? json.candidates[0] : null;
  const address = String(c?.address || c?.attributes?.Match_addr || '').trim();
  if (!address) return { ok: false };
  const score = typeof c?.score === 'number' ? c.score : typeof c?.attributes?.Score === 'number' ? c.attributes.Score : null;
  const strictOk = typeof score === 'number' ? score >= 90 : false;
  return {
    ok: strictOk,
    provider: 'ruian',
    id: `${address}:${String(score ?? '')}:0`,
    label: address,
    full: address,
    score,
    lon: typeof c?.location?.x === 'number' ? c.location.x : null,
    lat: typeof c?.location?.y === 'number' ? c.location.y : null,
  };
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'addrv',
      windowMs: 60_000,
      max: 60,
      honeypot: false,
      tooManyPayload: { ok: false },
      tooManyMessage: 'Rate limited',
      forbiddenPayload: { ok: false },
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const q = String(body?.q || body?.address || '').trim();
    const lang = body?.lang === 'en' ? 'en' : 'cs';
    if (q.length < 3) return NextResponse.json({ ok: false, error: 'Too short' }, { status: 400 });

    const provider = await getAddressProvider();
    const result = provider === 'ruian' ? await validateRuian(q) : await validateNominatim(q, lang);
    if (!result.ok && provider === 'ruian') {
      const fallback = await validateNominatim(q, lang);
      return NextResponse.json({ ok: fallback.ok, address: fallback.full || q, meta: fallback, provider: 'nominatim' });
    }
    return NextResponse.json({ ok: result.ok, address: (result as any).full || q, meta: result, provider: (result as any).provider || provider });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}
