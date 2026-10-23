'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumbs({ lang }: { lang: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean).slice(1); // Skip language segment

  const labels: Record<string, string> = {
    cs: { home: 'Domů', admin: 'Admin', dashboard: 'Nástěnka', events: 'Akce', news: 'Novinky', blog: 'Blog' },
    en: { home: 'Home', admin: 'Admin', dashboard: 'Dashboard', events: 'Events', news: 'News', blog: 'Blog' }
  }[lang] || { home: 'Domů' };

  return (
    <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-stone-400 mb-6 bg-stone-50/50 p-3 rounded-2xl border border-stone-100/50 w-fit">
      <Link href={`/${lang}`} className="flex items-center gap-1.5 hover:text-green-600 transition">
        <Home size={12} />
        {labels.home}
      </Link>
      
      {segments.map((segment, idx) => {
        const url = `/${lang}/${segments.slice(0, idx + 1).join('/')}`;
        const label = labels[segment] || segment;
        const isLast = idx === segments.length - 1;

        return (
          <React.Fragment key={idx}>
            <ChevronRight size={10} className="text-stone-300" />
            {isLast ? (
              <span className="text-green-600 font-bold">{label}</span>
            ) : (
              <Link href={url} className="hover:text-green-600 transition">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
