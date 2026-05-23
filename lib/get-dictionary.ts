import type { Dictionary, Locale } from './dictionary-types';

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  cs: () => import('../dictionaries/cs.merged').then((module) => module.default as unknown as Dictionary),
  en: () => import('../dictionaries/en.merged').then((module) => module.default as unknown as Dictionary),
};

type DictionaryCacheEntry = { value: Dictionary; atMs: number };

const cache: Partial<Record<Locale, DictionaryCacheEntry>> =
  ((globalThis as any).__PUPEN_DICTIONARY_CACHE__ as Partial<Record<Locale, DictionaryCacheEntry>> | undefined) || {};
(globalThis as any).__PUPEN_DICTIONARY_CACHE__ = cache;

export function normalizeLocale(locale: string): Locale {
  return locale === 'en' ? 'en' : 'cs';
}

function getDictionaryCacheTtlMs(): number {
  const raw = process.env.PUPEN_DICTIONARY_CACHE_TTL_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return process.env.NODE_ENV === 'development' ? 0 : 30 * 60 * 1000;
}

export function invalidateDictionaryCache(locale?: Locale) {
  if (locale) {
    delete cache[locale];
    return;
  }
  for (const k of Object.keys(cache) as Locale[]) {
    delete cache[k];
  }
}

export async function getDictionary(locale: string): Promise<Dictionary> {
  const l = normalizeLocale(locale);
  const ttlMs = getDictionaryCacheTtlMs();
  const hit = cache[l];
  if (hit && ttlMs > 0 && Date.now() - hit.atMs < ttlMs) return hit.value;

  const dict = await dictionaries[l]();
  cache[l] = { value: dict, atMs: Date.now() };
  return dict;
}
