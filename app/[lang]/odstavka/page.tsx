'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import InlinePulse from '@/app/components/InlinePulse';
import CountdownWidget from '@/app/[lang]/components/CountdownWidget';
import { decodeHtmlEntitiesDeep } from '@/lib/richtext-shared';

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
  const router = useRouter();
  const [cfg, setCfg] = useState<SiteConfig | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch('/api/site-config', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      const config = json?.config || null;
      if (mounted) setCfg(config);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const title =
    lang === 'en'
      ? cfg?.maintenance_title_en || 'Planned maintenance'
      : cfg?.maintenance_title_cs || 'Plánovaná odstávka';
  const body =
    lang === 'en'
      ? cfg?.maintenance_body_en || 'We are improving the website. Please try again later.'
      : cfg?.maintenance_body_cs ||
        'Na webu probíhá plánovaná údržba a dočasně není dostupný. Údržba slouží k úpravám, které zvyšují stabilitu a bezpečnost provozu. Pokud potřebujete urgentně řešit provozní záležitost, kontaktujte nás na info@pupen.org.';
  const otherLang = lang === 'en' ? 'cs' : 'en';

  const startAt = cfg?.maintenance_start_at ? new Date(String(cfg.maintenance_start_at)) : null;
  const endAt = cfg?.maintenance_end_at ? new Date(String(cfg.maintenance_end_at)) : null;
  const startMs = startAt && !Number.isNaN(startAt.getTime()) ? startAt.getTime() : null;
  const endMs = endAt && !Number.isNaN(endAt.getTime()) ? endAt.getTime() : null;
  const isActive =
    !!cfg?.maintenance_enabled && (!startMs || now >= startMs) && (!endMs || now < endMs);
  const showCountdown = (!!endMs && now < endMs) || (!!startMs && now < startMs);

  useEffect(() => {
    if (!cfg) return;
    if (!now) return;
    if (!isActive) router.replace(`/${lang}`);
  }, [cfg, isActive, lang, now, router]);

  const decodeHtmlEntities = (s: string) => decodeHtmlEntitiesDeep(String(s || ''), 3);

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const linkifyPlain = (s: string) => {
    const emailRe = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
    const phoneRe = /(\+?\d[\d\s().-]{7,}\d)/g;
    const safe = escapeHtml(s);
    const withEmails = safe.replace(emailRe, (m) => `<a href="mailto:${m}" class="underline font-bold">${m}</a>`);
    const withPhones = withEmails.replace(phoneRe, (m) => {
      const raw = m.replace(/[^\d+]/g, '');
      if (raw.length < 9) return m;
      return `<a href="tel:${raw}" class="underline font-bold">${m}</a>`;
    });
    return withPhones.replace(/\n/g, '<br/>');
  };

  const toPlainText = (input: string) => {
    const decoded = decodeHtmlEntities(input);
    const withBreaks = decoded
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*(p|div|li|h1|h2|h3|h4|blockquote)\s*>/gi, '\n');
    const stripped = withBreaks.replace(/<[^>]*>/g, '');
    return stripped
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const bodyHtml = linkifyPlain(toPlainText(body));

  return (
    <>
      <style jsx global>{`
        [data-pupen-banner],
        [data-pupen-navbar],
        [data-pupen-footer],
        [data-pupen-cookie],
        [data-pupen-faq] {
          display: none !important;
        }
      `}</style>
    <div className="min-h-screen bg-gradient-to-b from-white via-stone-50 to-white flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-end mb-6">
          <Link
            href={`/${otherLang}/odstavka`}
            className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            {otherLang.toUpperCase()}
          </Link>
        </div>
        <div className="flex flex-col items-center text-center mb-10">
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-full border border-stone-100 bg-white shadow-sm">
            <Image src="/logo.png" alt="Logo Pupen" fill className="object-cover" />
          </div>
          <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-stone-400">
            {cfg ? (isActive ? (lang === 'en' ? 'Maintenance active' : 'Odstávka aktivní') : (lang === 'en' ? 'Maintenance' : 'Odstávka')) : (
              <span className="inline-flex items-center gap-2">
                <InlinePulse className="bg-stone-200" size={14} />
                {lang === 'en' ? 'Loading...' : 'Načítám...'}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-black text-stone-900 tracking-tight">{title}</h1>
          <div
            className="mt-5 max-w-2xl w-full bg-white/80 border border-stone-100 rounded-[2rem] px-7 py-6 shadow-sm text-stone-700 font-medium leading-relaxed prose prose-stone prose-a:text-green-700 prose-a:font-bold prose-a:underline prose-p:my-3 prose-ul:my-3 prose-li:my-1"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        <div className="bg-white border border-stone-100 shadow-sm rounded-[3rem] p-8 sm:p-12">

        {showCountdown && (
          <div>
            <CountdownWidget
              targetDate={
                endMs
                  ? new Date(endMs).toISOString()
                  : startMs
                    ? new Date(startMs).toISOString()
                    : new Date(now).toISOString()
              }
              title={lang === 'en' ? 'Maintenance ends in' : 'Odstávka skončí za'}
              lang={lang}
              showPrefix={false}
            />
            <div className="mt-3 text-[11px] text-stone-500 font-medium">
              {endMs
                ? lang === 'en'
                  ? `Expected end: ${new Date(endMs).toLocaleString()}`
                  : `Předpokládaný konec: ${new Date(endMs).toLocaleString('cs-CZ')}`
                : null}
            </div>
          </div>
        )}

          <div className="mt-2" />
        </div>
      </div>
    </div>
    </>
  );
}
