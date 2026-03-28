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
      : cfg?.maintenance_body_cs || 'Právě vylepšujeme web. Zkuste to prosím později.';
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
  }, [cfg, isActive, lang, router]);

  const isProbablyHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

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

  const sanitizeAndLinkifyHtml = (html: string) => {
    try {
      if (typeof DOMParser === 'undefined') return linkifyPlain(html);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      if (!doc?.body) return linkifyPlain(html);
    const allowedTags = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE']);

    const walk = (node: any) => {
      if (!node) return;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toUpperCase();
        if (!allowedTags.has(tag)) {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
          }
          return;
        }

        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on') || name === 'style') {
            el.removeAttribute(attr.name);
            continue;
          }
          if (tag === 'A') {
            if (name !== 'href' && name !== 'target' && name !== 'rel' && name !== 'class') el.removeAttribute(attr.name);
          } else {
            if (name !== 'class') el.removeAttribute(attr.name);
          }
        }

        if (tag === 'A') {
          const href = el.getAttribute('href') || '';
          const safeHref = /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : '';
          if (!safeHref) el.removeAttribute('href');
          el.setAttribute('rel', 'noreferrer noopener');
          if (!el.getAttribute('target') && /^https?:\/\//i.test(href)) el.setAttribute('target', '_blank');
        }
      }

      const children = Array.from(node.childNodes || []);
      for (const child of children) walk(child);
    };

    walk(doc.body);

    const linkifyTextNodes = (node: any) => {
      if (!node) return;
      const isElement = node.nodeType === Node.ELEMENT_NODE;
      const hasLink = isElement && typeof (node as any).querySelector === 'function' ? (node as Element).querySelector('a') : null;
      if (hasLink) return;
      const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const targets: Text[] = [];
      let current: Node | null = walker.nextNode();
      while (current) {
        const t = current as Text;
        if (t.nodeValue && t.nodeValue.trim()) targets.push(t);
        current = walker.nextNode();
      }

      const emailRe = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
      const phoneRe = /(\+?\d[\d\s().-]{7,}\d)/g;

      for (const t of targets) {
        const text = t.nodeValue || '';
        if (!emailRe.test(text) && !phoneRe.test(text)) continue;
        emailRe.lastIndex = 0;
        phoneRe.lastIndex = 0;

        const container = doc.createElement('span');
        container.innerHTML = linkifyPlain(text);
        const parent = t.parentNode;
        if (!parent) continue;
        parent.replaceChild(container, t);
      }
    };

    linkifyTextNodes(doc.body);
    return doc.body.innerHTML;
    } catch {
      return linkifyPlain(html);
    }
  };

  const decodedBody = decodeHtmlEntities(body);
  const buildBodyHtml = (input: string) => (isProbablyHtml(input) ? sanitizeAndLinkifyHtml(input) : linkifyPlain(input));
  let bodyHtml = buildBodyHtml(decodedBody);
  if (bodyHtml.includes('&lt;') && /&lt;\/?[a-z]/i.test(bodyHtml)) {
    const decodedAgain = decodeHtmlEntities(bodyHtml);
    bodyHtml = buildBodyHtml(decodedAgain);
  }

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

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
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
    </div>
    </>
  );
}
