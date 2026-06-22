import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicGet } from '@/lib/public-post-guard';

interface SitePublicConfigRow {
  member_portal?: Record<string, unknown> | null;
}

interface AddressSuggestion {
  provider: 'nominatim' | 'ruian';
  id: string;
  label: string;
  full: string;
  city?: string;
  street?: string;
  house_number?: string;
  postcode?: string;
  lat: number | null;
  lon: number | null;
  score?: number | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickFirst(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function formatLabel(addr: Record<string, unknown>) {
  const street = pickFirst(addr, ['road', 'pedestrian', 'footway', 'street']);
  const house = pickFirst(addr, ['house_number']);
  const postcode = pickFirst(addr, ['postcode']);
  const city = pickFirst(addr, ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb']);

  const a = [street, house].filter(Boolean).join(' ');
  const b = [postcode, city].filter(Boolean).join(' ');
  return [a, b].filter(Boolean).join(', ');
}

function formatFull(addr: Record<string, unknown>) {
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
    const { data, error } = await supabase.from('site_public_config').select('member_portal').eq('id', 1).maybeSingle<SitePublicConfigRow>();
    if (error) return 'nominatim';
    const mp = toRecord(data?.member_portal);
    const v = String(mp.address_provider || '').trim().toLowerCase();
    return v === 'ruian' ? 'ruian' : 'nominatim';
  } catch {
    return 'nominatim';
  }
}

async function fetchNominatim(q: string, lang: string): Promise<AddressSuggestion[]> {
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
  const data = (await res.json().catch(() => [])) as unknown[];
  const items = (Array.isArray(data) ? data : []).map((entry) => {
    const item = toRecord(entry);
    const addr = toRecord(item.address);
    const displayName = asTrimmedString(item.display_name);
    const label = formatLabel(addr) || displayName;
    const full = formatFull(addr) || displayName;
    return {
      provider: 'nominatim',
      id: String(item.place_id || ''),
      label,
      full,
      city: pickFirst(addr, ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb']),
      street: pickFirst(addr, ['road', 'pedestrian', 'footway', 'street']),
      house_number: pickFirst(addr, ['house_number']),
      postcode: pickFirst(addr, ['postcode']),
      lat: asNullableNumber(item.lat),
      lon: asNullableNumber(item.lon),
    } satisfies AddressSuggestion;
  });
  return items;
}

async function fetchRuian(q: string): Promise<AddressSuggestion[]> {
  const base = 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Vyhledavaci_sluzba_nad_daty_RUIAN/MapServer/exts/GeocodeSOE/findAddressCandidates';
  const qs = new URLSearchParams({
    SingleLine: q,
    maxLocations: '8',
    outFields: 'Match_addr,Score',
    f: 'pjson',
  });
  const res = await fetch(`${base}?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = toRecord(await res.json().catch(() => ({})));
  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
  const items: AddressSuggestion[] = [];
  candidates.forEach((candidate, idx) => {
    const item = toRecord(candidate);
    const attributes = toRecord(item.attributes);
    const location = toRecord(item.location);
    const address = asTrimmedString(item.address || attributes.Match_addr);
    if (!address) return;

    const score = asNullableNumber(item.score) ?? asNullableNumber(attributes.Score);
    items.push({
      provider: 'ruian',
      id: `${address}:${String(score ?? '')}:${String(idx)}`,
      label: address,
      full: address,
      score,
      lon: asNullableNumber(location.x),
      lat: asNullableNumber(location.y),
    });
  });
  return items;
}

export async function GET(req: Request) {
  try {
    const g = await guardPublicGet(req, {
      keyPrefix: 'addr',
      windowMs: 60_000,
      max: 60,
      tooManyPayload: { ok: false },
      tooManyMessage: 'Rate limited',
    });
    if (!g.ok) return g.response;

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
