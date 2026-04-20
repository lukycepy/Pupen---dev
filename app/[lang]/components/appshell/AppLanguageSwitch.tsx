'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function swapLang(pathname: string, lang: string) {
  const segs = String(pathname || '/').split('/');
  if (segs.length > 1) segs[1] = lang;
  return segs.join('/') || `/${lang}`;
}

export default function AppLanguageSwitch({
  lang,
  hash,
  labels,
}: {
  lang: string;
  hash?: string | null;
  labels?: { cs?: string; en?: string };
}) {
  const pathname = usePathname();
  const suffix = hash ? `#${String(hash).replace('#', '')}` : '';
  const csHref = `${swapLang(pathname || `/${lang}`, 'cs')}${suffix}`;
  const enHref = `${swapLang(pathname || `/${lang}`, 'en')}${suffix}`;

  return (
    <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/80 border border-stone-200 shadow-sm">
      <Link
        href={csHref}
        className={
          lang === 'cs'
            ? 'px-3 py-1.5 rounded-xl bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest'
            : 'px-3 py-1.5 rounded-xl text-stone-500 hover:bg-stone-50 text-[10px] font-black uppercase tracking-widest'
        }
        aria-label={labels?.cs || 'CZ'}
      >
        CZ
      </Link>
      <Link
        href={enHref}
        className={
          lang === 'en'
            ? 'px-3 py-1.5 rounded-xl bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest'
            : 'px-3 py-1.5 rounded-xl text-stone-500 hover:bg-stone-50 text-[10px] font-black uppercase tracking-widest'
        }
        aria-label={labels?.en || 'EN'}
      >
        EN
      </Link>
    </div>
  );
}

