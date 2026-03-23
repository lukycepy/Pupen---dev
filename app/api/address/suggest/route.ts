import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';

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

async function fetchNominatim(q: string, lang: string) {
  const qs = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
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
  if (!res.ok) return [];
  const data = (await res.json().catch(() => [])) as any[];
  const items = (Array.isArray(data) ? data : []).map((x) => {
    const addr = x?.address || {};
    const label = formatLabel(addr) || String(x?.display_name || '').trim();
    const full = formatFull(addr) || String(x?.display_name || '').trim();
    return {
      id: String(x?.place_id || ''),
      label,
      full,
      city: pickFirst(addr, ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb']),
      street: pickFirst(addr, ['road', 'pedestrian', 'footway', 'street']),
      house_number: pickFirst(addr, ['house_number']),
      postcode: pickFirst(addr, ['postcode']),
    };
  });
  return items;
}

async function fetchRuian(q: string) {
  const base = 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Vyhledavaci_sluzba_nad_daty_RUIAN/MapServer/exts/GeocodeSOE/findAddressCandidates';
  const qs = new URLSearchParams({
    SingleLine: q,
    maxLocations: '8',
    outFields: 'Match_addr,Score',
    f: 'pjson',
  });
  const res = await fetch(`${base}?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json: any = await res.json().catch(() => ({}));
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  return candidates
    .map((c: any, idx: number) => {
      const address = String(c?.address || c?.attributes?.Match_addr || '').trim();
      if (!address) return null;
      const score = typeof c?.score === 'number' ? c.score : typeof c?.attributes?.Score === 'number' ? c.attributes.Score : null;
      return {
        id: `${address}:${String(score ?? '')}:${String(idx)}`,
        label: address,
        full: address,
      };
    })
    .filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `addr:${ip}`, windowMs: 60_000, max: 60 });
    if (!rl.ok) return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });

    const url = new URL(req.url);
    const q = String(url.searchParams.get('q') || '').trim();
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'cs';
    if (q.length < 3) return NextResponse.json({ ok: true, items: [] });

    const provider = await getAddressProvider();
    const items = provider === 'ruian' ? await fetchRuian(q) : await fetchNominatim(q, lang);
    if (items.length === 0 && provider === 'ruian') {
      const fallback = await fetchNominatim(q, lang);
      return NextResponse.json({ ok: true, items: fallback, provider: 'nominatim' });
    }
    return NextResponse.json({ ok: true, items, provider });
  } catch {
    return NextResponse.json({ ok: true, items: [] });
  }
}
