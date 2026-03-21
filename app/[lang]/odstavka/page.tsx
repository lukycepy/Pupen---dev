'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import InlinePulse from '@/app/components/InlinePulse';
import CountdownWidget from '@/app/[lang]/components/CountdownWidget';

type SiteConfig = {
  maintenance_enabled: boolean;
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  maintenance_active?: boolean;
  maintenance_title_cs: string | null;
  maintenance_body_cs: string | null;
  maintenance_title_en: string | null;
  maintenance_body_en: string | null;
};

export default function MaintenancePage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [cfg, setCfg] = useState<SiteConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch('/api/site-config');
      const json = await res.json().catch(() => ({}));
      const config = json?.config || null;
      if (mounted) setCfg(config);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const title =
    lang === 'en'
      ? cfg?.maintenance_title_en || 'Planned maintenance'
      : cfg?.maintenance_title_cs || 'Plánovaná odstávka';
  const body =
    lang === 'en'
      ? cfg?.maintenance_body_en || 'We are improving the website. Please try again later.'
      : cfg?.maintenance_body_cs || 'Právě vylepšujeme web. Zkuste to prosím později.';

  const now = Date.now();
  const startAt = cfg?.maintenance_start_at ? new Date(String(cfg.maintenance_start_at)) : null;
  const endAt = cfg?.maintenance_end_at ? new Date(String(cfg.maintenance_end_at)) : null;
  const startMs = startAt && !Number.isNaN(startAt.getTime()) ? startAt.getTime() : null;
  const endMs = endAt && !Number.isNaN(endAt.getTime()) ? endAt.getTime() : null;
  const inWindow = !!startMs && now >= startMs && (!endMs || now < endMs);
  const showCountdown = !!endMs || (!!startMs && now < startMs);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16 bg-stone-50">
      <div className="w-full max-w-2xl bg-white border border-stone-100 shadow-sm rounded-[2.5rem] p-10">
        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
          {cfg ? (cfg.maintenance_enabled ? (lang === 'en' ? 'Maintenance enabled' : 'Odstávka aktivní') : (lang === 'en' ? 'Maintenance page' : 'Stránka odstávky')) : (
            <span className="inline-flex items-center gap-2">
              <InlinePulse className="bg-stone-200" size={14} />
              {lang === 'en' ? 'Loading...' : 'Načítám...'}
            </span>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">{title}</h1>
        <p className="mt-4 text-stone-600 font-medium leading-relaxed">{body}</p>

        {showCountdown && (
          <div className="mt-8">
            <CountdownWidget
              targetDate={
                endMs
                  ? new Date(endMs).toISOString()
                  : startMs
                    ? new Date(startMs).toISOString()
                    : new Date().toISOString()
              }
              title={
                endMs && inWindow
                  ? (lang === 'en' ? 'Maintenance ends in' : 'Odstávka skončí za')
                  : (lang === 'en' ? 'Maintenance starts in' : 'Odstávka začne za')
              }
              lang={lang}
            />
            <div className="mt-3 text-[11px] text-stone-500 font-medium">
              {endMs && inWindow
                ? (lang === 'en'
                    ? `Expected end: ${new Date(endMs).toLocaleString()}`
                    : `Předpokládaný konec: ${new Date(endMs).toLocaleString('cs-CZ')}`)
                : startMs
                  ? (lang === 'en'
                      ? `Planned start: ${new Date(startMs).toLocaleString()}`
                      : `Plánovaný start: ${new Date(startMs).toLocaleString('cs-CZ')}`)
                  : null}
            </div>
          </div>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/${lang}`}
            className="inline-flex items-center justify-center rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            {lang === 'en' ? 'Back to home' : 'Zpět na domů'}
          </Link>
          <a
            href="mailto:info@pupen.org"
            className="inline-flex items-center justify-center rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
          >
            {lang === 'en' ? 'Contact us' : 'Kontakt'}
          </a>
        </div>
      </div>
    </div>
  );
}
