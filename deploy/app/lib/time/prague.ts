export type PupenLang = 'cs' | 'en';

export const PRAGUE_TZ = 'Europe/Prague';

function toDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const d = new Date(String(input));
  return isNaN(d.getTime()) ? null : d;
}

function getParts(
  input: any,
  lang: PupenLang,
  opts: Intl.DateTimeFormatOptions,
): Record<string, string> | null {
  const d = toDate(input);
  if (!d) return null;
  const locale = lang === 'en' ? 'en-GB' : 'cs-CZ';
  const fmt = new Intl.DateTimeFormat(locale, { timeZone: PRAGUE_TZ, ...opts });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return out;
}

export function formatDatePrague(input: any, lang: PupenLang = 'cs') {
  const p = getParts(input, lang, { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (!p) return '';
  if (lang === 'en') return `${p.day}/${p.month}/${p.year}`;
  return `${p.day}.${p.month}.${p.year}`;
}

export function formatDateTimePrague(input: any, lang: PupenLang = 'cs') {
  const p = getParts(input, lang, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  if (!p) return '';
  const date = lang === 'en' ? `${p.day}/${p.month}/${p.year}` : `${p.day}.${p.month}.${p.year}`;
  return `${date} ${p.hour}:${p.minute}`;
}

export function getPragueYearTwoDigits(input: any) {
  const p = getParts(input || new Date(), 'cs', { year: 'numeric' });
  const yyyy = p?.year ? Number(p.year) : NaN;
  if (!Number.isFinite(yyyy)) return '';
  return String(yyyy % 100).padStart(2, '0');
}

