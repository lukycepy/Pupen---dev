'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Facebook, Instagram, Mail, Info, Users } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { richTextToClientHtml } from '@/lib/richtext-client';
import type { OnepageConfig, PublicSiteMode } from '@/lib/site/public-mode';
import { DEFAULT_ONEPAGE_CONFIG } from '@/lib/site/public-mode';
import { getCachedPublicSiteConfig } from '@/lib/site/public-config-client';

type SiteConfig = {
  public_mode?: PublicSiteMode;
  mode_active?: boolean;
  onepage_active?: boolean;
  onepage?: OnepageConfig | null;
};

function safeHref(value: string, fallback: string) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (text.startsWith('/')) return text;
  if (/^https?:\/\//i.test(text) || /^mailto:/i.test(text)) return text;
  return fallback;
}

function localizeInternalHref(href: string, lang: string) {
  if (!href.startsWith('/')) return href;
  if (href === '/cs/prihlaska' || href === '/en/prihlaska') return `/${lang}/prihlaska`;
  if (href === '/cs/kontakt' || href === '/en/kontakt') return `/${lang}/kontakt`;
  return href;
}

export default function InfoPage() {
  const params = useParams();
  const router = useRouter();
  const lang = (params?.lang as string) || 'cs';
  const isEn = lang === 'en';
  const [cfg, setCfg] = useState<SiteConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const json = await getCachedPublicSiteConfig();
      if (mounted) setCfg((json?.config || null) as SiteConfig | null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isActive = cfg?.public_mode === 'onepage' && cfg?.onepage_active === true && cfg?.mode_active === true;

  useEffect(() => {
    if (!cfg) return;
    if (!isActive) router.replace(`/${lang}`);
  }, [cfg, isActive, lang, router]);

  const onepage = useMemo(() => ({ ...DEFAULT_ONEPAGE_CONFIG, ...(cfg?.onepage || {}) }), [cfg]);
  const otherLang = isEn ? 'cs' : 'en';
  const primaryHref = localizeInternalHref(safeHref(onepage.primary_href, `/${lang}/prihlaska`), lang);
  const secondaryHref = localizeInternalHref(safeHref(onepage.secondary_href, `/${lang}/kontakt`), lang);
  const instagramHref = safeHref(onepage.instagram_url, '');
  const facebookHref = safeHref(onepage.facebook_url, '');
  const contactEmail = String(onepage.contact_email || DEFAULT_ONEPAGE_CONFIG.contact_email).trim();

  const copy = {
    badge: isEn ? onepage.badge_en : onepage.badge_cs,
    title: isEn ? onepage.title_en : onepage.title_cs,
    intro: isEn ? onepage.intro_en : onepage.intro_cs,
    about: richTextToClientHtml(isEn ? onepage.about_en : onepage.about_cs),
    membership: richTextToClientHtml(isEn ? onepage.membership_en : onepage.membership_cs),
    contacts: richTextToClientHtml(isEn ? onepage.contacts_en : onepage.contacts_cs),
    status: richTextToClientHtml(isEn ? onepage.status_en : onepage.status_cs),
    primaryLabel: isEn ? onepage.primary_label_en : onepage.primary_label_cs,
    secondaryLabel: isEn ? onepage.secondary_label_en : onepage.secondary_label_cs,
    aboutTitle: isEn ? 'About the association' : 'O spolku',
    membershipTitle: isEn ? 'Membership' : 'Členství',
    contactsTitle: isEn ? 'Contacts' : 'Kontakty',
    statusTitle: isEn ? 'Status info' : 'Status info',
    socialsTitle: isEn ? 'Social channels' : 'Sociální sítě',
  };

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
      <div className="min-h-screen bg-white px-6 py-10 text-black dark:bg-black dark:text-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link
            href={`/${otherLang}/info`}
            className="inline-flex items-center justify-center rounded-xl border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
          >
            {otherLang.toUpperCase()}
          </Link>
        </div>

        {!cfg ? (
          <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center">
            <span className="inline-flex items-center gap-3 rounded-2xl border-2 border-black bg-white px-5 py-4 text-sm font-bold text-black dark:border-white dark:bg-black dark:text-white">
              <InlinePulse className="bg-black dark:bg-white" size={14} />
              {isEn ? 'Loading onepage...' : 'Načítám onepage...'}
            </span>
          </div>
        ) : (
          <div className="mx-auto mt-8 w-full max-w-6xl space-y-8">
            <section className="rounded-[2rem] border-2 border-black bg-white p-8 dark:border-white dark:bg-black md:p-12">
              <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-black dark:border-white dark:bg-black dark:text-white">
                    <Image src="/logo.png" alt="Logo Pupen" width={22} height={22} className="rounded-full border border-black bg-white p-0.5 dark:border-white" />
                    {copy.badge}
                  </div>
                  <h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">{copy.title}</h1>
                  <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-black dark:text-white">{copy.intro}</p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={primaryHref}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-green-600 bg-green-600 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:border-green-700 hover:bg-green-700"
                    >
                      {copy.primaryLabel}
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      href={secondaryHref}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-black bg-white px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
                    >
                      {copy.secondaryLabel}
                    </Link>
                  </div>
                </div>

                <div className="flex min-w-[220px] items-center justify-center self-start rounded-[2rem] border-2 border-black bg-white p-6 dark:border-white dark:bg-black">
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-black bg-white dark:border-white dark:bg-white">
                    <Image src="/logo.png" alt="Logo Pupen" fill className="object-contain p-3" />
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[2rem] border-2 border-black bg-white p-8 dark:border-white dark:bg-black">
                <div className="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                  <Users size={18} className="text-green-600 dark:text-green-500" />
                  {copy.aboutTitle}
                </div>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: copy.about }} />
              </section>

              <section className="rounded-[2rem] border-2 border-black bg-white p-8 dark:border-white dark:bg-black">
                <div className="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                  <ArrowRight size={18} className="text-green-600 dark:text-green-500" />
                  {copy.membershipTitle}
                </div>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: copy.membership }} />
              </section>

              <section className="rounded-[2rem] border-2 border-black bg-white p-8 dark:border-white dark:bg-black">
                <div className="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                  <Mail size={18} className="text-green-600 dark:text-green-500" />
                  {copy.contactsTitle}
                </div>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: copy.contacts }} />
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={`mailto:${contactEmail}`}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
                  >
                    <Mail size={14} />
                    {contactEmail}
                  </a>
                </div>
                {(instagramHref || facebookHref) && (
                  <div className="mt-6">
                    <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-black dark:text-white">{copy.socialsTitle}</div>
                    <div className="flex flex-wrap gap-3">
                      {instagramHref ? (
                        <a
                          href={instagramHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
                        >
                          <Instagram size={14} />
                          Instagram
                        </a>
                      ) : null}
                      {facebookHref ? (
                        <a
                          href={facebookHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
                        >
                          <Facebook size={14} />
                          Facebook
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-[2rem] border-2 border-black bg-white p-8 dark:border-white dark:bg-black">
                <div className="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                  <Info size={18} className="text-green-600 dark:text-green-500" />
                  {copy.statusTitle}
                </div>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: copy.status }} />
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
