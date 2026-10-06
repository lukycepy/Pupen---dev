'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { Dictionary, Locale } from '@/lib/dictionary-types';

type DictionaryContextValue = {
  lang: Locale;
  dict: Dictionary;
};

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

export function DictionaryProvider({
  lang,
  dict,
  children,
}: {
  lang: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ lang, dict }), [lang, dict]);
  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

export function useDictionary(): Dictionary {
  const ctx = useContext(DictionaryContext);
  if (!ctx) throw new Error('useDictionary must be used within DictionaryProvider');
  return ctx.dict;
}

export function useLang(): Locale {
  const ctx = useContext(DictionaryContext);
  if (!ctx) throw new Error('useLang must be used within DictionaryProvider');
  return ctx.lang;
}

