'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf, Instagram, Facebook, Mail, MapPin, ArrowRight, CheckCircle } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { getCachedPublicSiteConfig } from '@/lib/site/public-config-client';

interface FooterProps {
  lang: string;
  dict: any;
}

export default function Footer({ lang, dict }: FooterProps) {
  const t = dict && typeof dict === 'object' ? (dict as any) : {};
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [honeyPot, setHoneyPot] = useState('');
  const [sitePages, setSitePages] = useState<Record<string, any> | null>(null);
  const [instagramUrl, setInstagramUrl] = useState<string>('https://instagram.com/pupenfappz/');
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const json = await getCachedPublicSiteConfig();
        const pages = json?.config?.pages;
        const home = json?.config?.home && typeof json.config.home === 'object'
          ? (json.config.home as Record<string, unknown>)
          : null;
        const instagram = home?.instagram && typeof home.instagram === 'object'
          ? (home.instagram as Record<string, unknown>)
          : null;
        const ig = typeof instagram?.url === 'string' ? instagram.url : null;
        if (mounted && pages && typeof pages === 'object') setSitePages(pages);
        if (mounted && typeof ig === 'string' && ig.trim()) setInstagramUrl(ig.trim());
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isPageEnabled = (slug: string) => {
    const cfg = sitePages?.[slug];
    if (!cfg) return true;
    return cfg.enabled !== false;
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setStatus('idle');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), categories: ['all'], source: 'footer', hp: honeyPot }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');

      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 5000);
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const isAppSection = pathname?.includes('/admin') || pathname?.includes('/clen');

  return (
    <footer className={`bg-black text-white py-16 border-t-2 border-white font-sans ${isAppSection ? 'lg:pl-72' : ''}`}>
      <div className="max-w-7xl mx-auto px-6">
        
        {/* HORNÍ ČÁST FOOTERU */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          {/* 1. Sloupec: Značka a popis */}
          <div className="lg:col-span-1">
            <Link href={`/${lang}`} className="flex items-center gap-3 text-white mb-6 group w-fit">
              <div className="bg-black p-2.5 rounded-xl group-hover:bg-green-600 transition-all duration-300 border-2 border-white">
                <Leaf className="text-green-500 w-5 h-5 group-hover:text-white transition-colors" />
              </div>
              <span className="font-black text-xl tracking-tight">Pupen</span>
            </Link>
            <p className="text-sm leading-relaxed mb-6 text-white">
              {t.description || ''}
            </p>
          </div>

          {/* 2. Sloupec: Rychlé odkazy */}
          <div>
            <h3 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">{t.menuTitle || (lang === 'en' ? 'Menu' : 'Menu')}</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href={`/${lang}`} className="text-white hover:text-green-500 transition duration-300 flex items-center gap-2">
                  {t.home || (lang === 'en' ? 'Home' : 'Domů')}
                </Link>
              </li>
              <li>
                {isPageEnabled('akce') && (
                  <Link href={`/${lang}/akce`} className="text-white hover:text-green-500 transition duration-300 flex items-center gap-2">
                    {t.events || (lang === 'en' ? 'Events' : 'Akce')}
                  </Link>
                )}
              </li>
              <li>
                {isPageEnabled('o-nas') && (
                  <Link href={`/${lang}/o-nas`} className="text-white hover:text-green-500 transition duration-300 flex items-center gap-2">
                    {t.about || (lang === 'en' ? 'About' : 'O nás')}
                  </Link>
                )}
              </li>
              <li>
                {isPageEnabled('kontakt') && (
                  <Link href={`/${lang}/kontakt`} className="text-white hover:text-green-500 transition duration-300 flex items-center gap-2">
                    {t.contact || (lang === 'en' ? 'Contact' : 'Kontakt')}
                  </Link>
                )}
              </li>
            </ul>
          </div>

          {/* 3. Sloupec: Kontakt */}
          <div>
            <h3 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">{t.findUs || (lang === 'en' ? 'Find us' : 'Najdeš nás')}</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3 text-white">
                <MapPin className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <span className="text-sm whitespace-pre-line">
                  {t.address || ''}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-green-600 shrink-0" />
                <a href={`mailto:${t.contactEmail || 'info@pupen.org'}`} className="text-white hover:text-green-500 transition text-sm">
                  {t.contactEmail || 'info@pupen.org'}
                </a>
              </li>
            </ul>
          </div>

          {/* 4. Sloupec: Newsletter */}
          <div>
            <h3 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">{t.newsletterTitle || 'Newsletter'}</h3>
            <p className="text-sm mb-4 text-white">{t.newsletterText || ''}</p>
            
            <form onSubmit={handleSubscribe} className="relative mb-8">
              <input
                type="text"
                name="website"
                value={honeyPot}
                onChange={(e) => setHoneyPot(e.target.value)}
                className="opacity-0 absolute -z-10 w-0 h-0"
                tabIndex={-1}
                autoComplete="off"
              />
              <div className="flex gap-2">
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder || (lang === 'en' ? 'Email' : 'Email')}
                  className="bg-black text-white text-sm px-4 py-3 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-green-600 border-2 border-white placeholder:text-white transition-all"
                />
                <button 
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 text-white p-3 rounded-xl hover:bg-green-500 transition-all border-2 border-green-600 hover:border-green-500 disabled:opacity-50"
                >
                  {loading ? <InlinePulse className="bg-white/80" size={14} /> : <ArrowRight size={20} />}
                </button>
              </div>

              {status === 'success' && (
                <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-green-500 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                  <CheckCircle size={14} /> {t.subscribeSuccess || (lang === 'en' ? 'Subscribed!' : 'Přihlášeno!')}
                </div>
              )}
              {status === 'error' && (
                <div className="absolute top-full left-0 mt-2 text-red-500 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                  {t.subscribeError || (lang === 'en' ? 'Subscription failed.' : 'Nepodařilo se přihlásit.')}
                </div>
              )}
            </form>

            <div className="flex gap-4">
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="bg-black border-2 border-white p-2.5 rounded-full hover:bg-green-600 hover:border-green-600 hover:text-white transition duration-300">
                <Instagram size={20} />
              </a>
              <a href="https://facebook.com/pupenfappz/" target="_blank" rel="noopener noreferrer" className="bg-black border-2 border-white p-2.5 rounded-full hover:bg-green-600 hover:border-green-600 hover:text-white transition duration-300">
                <Facebook size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* SPODNÍ ČÁST FOOTERU */}
        <div className="pt-8 border-t border-white flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white">
          <p>© {new Date().getFullYear()} Studentský spolek Pupen, z.s. {t.rights || ''}</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href={`/${lang}/ochrana-soukromi`} className="text-white hover:text-green-500 transition">{t.privacy || (lang === 'en' ? 'Privacy' : 'Soukromí')}</Link>
            <Link href={`/${lang}/tos`} className="text-white hover:text-green-500 transition">{t.tos || (lang === 'en' ? 'Terms' : 'Podmínky')}</Link>
            <Link href={`/${lang}/cookies`} className="text-white hover:text-green-500 transition">{t.cookies || (lang === 'en' ? 'Cookies' : 'Cookies')}</Link>
            {isPageEnabled('support') && (
              <Link href={`/${lang}/support`} className="text-white hover:text-green-500 transition">{t.support || (lang === 'en' ? 'Support' : 'Podpora')}</Link>
            )}
            {isPageEnabled('roadmap') && (
              <Link href={`/${lang}/roadmap`} className="text-white hover:text-green-500 transition">{t.roadmap || 'Roadmap'}</Link>
            )}
            {isPageEnabled('changelog') && (
              <Link href={`/${lang}/changelog`} className="text-white hover:text-green-500 transition">{t.changelog || 'Changelog'}</Link>
            )}
            {isPageEnabled('prvni-pomoc') && (
              <Link href={`/${lang}/prvni-pomoc`} className="text-white hover:text-green-500 transition">{t.firstAid || (lang === 'en' ? 'First aid' : 'První pomoc')}</Link>
            )}
            {isPageEnabled('bezpecnost') && (
              <Link href={`/${lang}/bezpecnost`} className="text-white hover:text-green-500 transition">{t.safety || (lang === 'en' ? 'Safety' : 'Bezpečnost')}</Link>
            )}
            {isPageEnabled('vybor') && (
              <Link href={`/${lang}/vybor`} className="text-white hover:text-green-500 transition">{t.board || (lang === 'en' ? 'Faces' : 'Tváře spolku')}</Link>
            )}
            {isPageEnabled('vyrocni-zpravy') && (
              <Link href={`/${lang}/vyrocni-zpravy`} className="text-white hover:text-green-500 transition">{t.annualReports || (lang === 'en' ? 'Annual reports' : 'Výroční zprávy')}</Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
