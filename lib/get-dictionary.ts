// Soubor: lib/get-dictionary.ts
const dictionaries = {
    cs: () => import('../dictionaries/cs.json').then((module) => module.default),
    en: () => import('../dictionaries/en.json').then((module) => module.default),
  };
 
  const cache: Record<string, any> =
    (globalThis as any).__PUPEN_DICTIONARY_CACHE__ || {};
  (globalThis as any).__PUPEN_DICTIONARY_CACHE__ = cache;

  export const getDictionary = async (locale: string) => {
    const l = locale === 'en' ? 'en' : 'cs';
    if (cache[l]) return cache[l];
    
    const dict = await (dictionaries[l as keyof typeof dictionaries]?.() ?? dictionaries.cs());
    cache[l] = dict;
    return dict;
  };
