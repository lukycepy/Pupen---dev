'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, X, Search, Calendar, FileText, 
  ChevronDown, BookOpen, ShieldCheck, Users, Tag, Clock, PenTool, BrainCircuit, Briefcase, HelpCircle, KeyRound, Siren, Archive, LifeBuoy, Image as ImageIcon, HeartHandshake, Handshake
} from 'lucide-react';
import Image from 'next/image';
import InlinePulse from '@/app/components/InlinePulse';
import Drawer from '@/app/components/ui/Drawer';
import Popover from '@/app/components/ui/Popover';
import ThemeToggleButton from '@/app/components/ThemeToggleButton';
import type { Dictionary } from '@/lib/dictionary-types';
import type { SearchResponse, SearchResults, SitePageVisibilityConfig } from '@/types/search';

interface NavbarProps {
  lang: string;
  dict: Dictionary['nav'];
}

type NavToolCopy = {
  title?: string;
  sub?: string;
};

type NavToolsDictionary = Partial<Record<string, NavToolCopy>> & {
  dropdownTitle?: string;
};

export default function Navbar({ lang, dict }: NavbarProps) {
  const t = dict;
  const navTools = (t?.tools && typeof t.tools === 'object' ? t.tools : {}) as NavToolsDictionary;
  const toolsTitle = navTools?.dropdownTitle || (lang === 'en' ? 'Tools' : 'Nástroje');
  const searchPlaceholder = lang === 'en' ? 'Search…' : 'Vyhledat…';
  const searchNoResults = lang === 'en' ? 'No results found.' : 'Nic nenalezeno';
  const navHome = t?.home || (lang === 'en' ? 'Home' : 'Domů');
  const navEvents = t?.events || (lang === 'en' ? 'Events' : 'Akce');
  const navNews = t?.news || (lang === 'en' ? 'News' : 'Novinky');
  const utilityButtonClass =
    'inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white px-3 text-black transition-all hover:border-green-600 hover:bg-green-600 hover:text-white dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-500 dark:hover:text-black';
  const utilityGroupClass =
    'flex h-10 shrink-0 items-center gap-1 rounded-xl border-2 border-black bg-white p-1 text-black dark:border-white dark:bg-black dark:text-white';

  const humanizeSlug = (s: string) => String(s || '').replace(/-/g, ' ');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults>({
    pages: [],
    events: [],
    posts: [],
    faqs: [],
    books: [],
    discounts: [],
    guide: [],
    archive: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [sitePages, setSitePages] = useState<Record<string, SitePageVisibilityConfig> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/site-config', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        const pages = json?.config?.pages;
        if (mounted && pages && typeof pages === 'object') setSitePages(pages);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const pathname = usePathname();
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsToolsOpen(false);
  }, [pathname]);

  // Search logic
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults({ pages: [], events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = new URL('/api/search', window.location.origin);
        url.searchParams.set('q', searchQuery);
        url.searchParams.set('lang', lang);
        url.searchParams.set('limit', '3');
        const res = await fetch(url.toString());
        const json = (await res.json().catch(() => ({}))) as Partial<SearchResponse> & { error?: string };
        if (!res.ok) throw new Error(json?.error || 'Chyba');
        setSearchResults(json?.results || { pages: [], events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });
      } catch {
        setSearchResults({ pages: [], events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [lang, searchQuery]);

  const TOOLS = [
    { href: '/ztraty-a-nalezy', slug: 'ztraty-a-nalezy', icon: <KeyRound size={18} />, key: 'lostFound' },
    { href: '/sos', slug: 'sos', icon: <Siren size={18} />, key: 'sos' },
    { href: '/schranka-duvery', slug: 'schranka-duvery', icon: <LifeBuoy size={18} />, key: 'trustbox' },
    { href: '/predmety', slug: 'predmety', icon: <BookOpen size={18} />, key: 'subjects' },
    { href: '/harmonogram', slug: 'harmonogram', icon: <Calendar size={18} />, key: 'schedule' },
    { href: '/pruvodce', slug: 'pruvodce', icon: <ShieldCheck size={18} />, key: 'guide' },
    { href: '/partaci', slug: 'partaci', icon: <Users size={18} />, key: 'partners' },
    { href: '/archiv', slug: 'archiv', icon: <Archive size={18} />, key: 'archive' },
    { href: '/galerie', slug: 'galerie', icon: <ImageIcon size={18} />, key: 'gallery' },
    { href: '/daruj', slug: 'daruj', icon: <HeartHandshake size={18} />, key: 'donate' },
    { href: '/partnerstvi', slug: 'partnerstvi', icon: <Handshake size={18} />, key: 'partnership' },
    { href: '/slevy', slug: 'slevy', icon: <Tag size={18} />, key: 'discounts' },
    { href: '/oteviraci-doba', slug: 'oteviraci-doba', icon: <Clock size={18} />, key: 'hours' },
    { href: '/blog', slug: 'blog', icon: <PenTool size={18} />, key: 'blog' },
    { href: '/kvizy', slug: 'kvizy', icon: <BrainCircuit size={18} />, key: 'quizzes' },
    { href: '/kariera', slug: 'kariera', icon: <Briefcase size={18} />, key: 'jobs' },
    { href: '/faq', slug: 'faq', icon: <HelpCircle size={18} />, key: 'faq' },
  ];

  const isPageEnabled = (slug: string) => {
    const cfg = sitePages?.[slug];
    if (!cfg) return true;
    return cfg.enabled !== false;
  };
  const showInNavbar = (slug: string) => {
    const cfg = sitePages?.[slug];
    if (!cfg) return true;
    return cfg.navbar !== false;
  };
  const showInTools = (slug: string) => {
    const cfg = sitePages?.[slug];
    if (!cfg) return true;
    return cfg.tools !== false;
  };

  // Funkce pro změnu jazyka v aktuální URL
  const getTransliteratedPath = (newLang: string) => {
    if (!pathname) return `/${newLang}`;
    const segments = pathname.split('/');
    segments[1] = newLang; // Nahradí cs za en nebo naopak
    return segments.join('/');
  };

  // Hide navbar in admin and member portal
  const isAppSection = pathname?.includes('/admin') || pathname?.includes('/clen') || pathname?.includes('/odstavka');
  if (isAppSection) return null;

  return (
    <nav className="sticky top-0 z-[10001] w-full bg-white dark:bg-black border-b-2 border-black dark:border-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          
          {/* LOGO */}
          <Link href={`/${lang}`} className="flex items-center gap-2 sm:gap-3 group shrink-0 mr-4">
            <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full transition duration-300 group-hover:scale-105 sm:h-9 sm:w-9">
              <Image 
                src="/logo.png" 
                alt="Logo Spolek Pupen" 
                fill
                className="object-contain dark:[filter:drop-shadow(0_0_1px_#fff)_drop-shadow(0_0_2px_#fff)]"
              />
            </div>
            <span className="hidden sm:inline max-w-[180px] truncate font-bold text-base tracking-tight text-black transition group-hover:text-green-600 sm:max-w-none sm:text-lg dark:text-white">
              Studentský spolek Pupen, z.s.
            </span>
          </Link>

          {/* DESKTOP MENU */}
          <div className="hidden xl:flex items-center gap-5 font-medium text-[13px] tracking-normal text-black dark:text-white">
            {[ 
              { slug: 'home', href: `/${lang}`, label: navHome, active: pathname === `/${lang}` },
              { slug: 'akce', href: `/${lang}/akce`, label: navEvents, active: pathname.includes('/akce') },
              { slug: 'novinky', href: `/${lang}/novinky`, label: navNews, active: pathname.includes('/novinky') },
            ]
              .filter((item) => item.slug === 'home' || (isPageEnabled(item.slug) && showInNavbar(item.slug)))
              .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 py-2 group whitespace-nowrap ${
                  item.active 
                    ? 'text-green-600' 
                    : 'text-black hover:text-green-600 dark:text-white dark:hover:text-green-500'
                }`}
              >
                {item.label}
                <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-green-600 transition-all duration-300 transform origin-left ${
                  item.active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`} />
              </Link>
            ))}
            
            {/* TOOLS DROPDOWN */}
            <div 
              ref={toolsRef}
              className="relative"
            >
              <button 
                type="button"
                onClick={() => {
                  setIsToolsOpen((v) => !v);
                }}
                aria-haspopup="menu"
                aria-expanded={isToolsOpen}
                className={`relative group flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 py-2 whitespace-nowrap ${
                  isToolsOpen ? 'text-green-600' : 'text-black hover:text-green-600 dark:text-white dark:hover:text-green-500'
                }`}
              >
                {toolsTitle}
                <ChevronDown size={14} className={`transition-transform duration-300 ${isToolsOpen ? 'rotate-180' : ''}`} />
                <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-green-600 transition-all duration-300 transform origin-left ${
                  isToolsOpen ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`} />
              </button>
              
              {isToolsOpen && (
                <Popover
                  open={isToolsOpen}
                  onClose={() => setIsToolsOpen(false)}
                  anchorRef={toolsRef}
                  placement="bottom-center"
                  offset={10}
                  zIndex={10000}
                  panelClassName="w-[520px] bg-white dark:bg-black border-2 border-black dark:border-white rounded-[2.5rem] p-8 animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {TOOLS.filter((t) => isPageEnabled(t.slug) && showInTools(t.slug)).map((tool) => (
                      <Link 
                        key={tool.href}
                        href={`/${lang}${tool.href}`} 
                        className="flex items-center gap-4 rounded-2xl border-2 border-transparent p-4 transition group/tool hover:border-green-600 hover:bg-green-50 dark:hover:border-green-500 dark:hover:bg-green-950"
                        onClick={() => setIsToolsOpen(false)}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black bg-white text-black transition-all duration-300 group-hover/tool:border-green-600 group-hover/tool:bg-green-600 group-hover/tool:text-white dark:border-white dark:bg-black dark:text-white dark:group-hover/tool:border-green-500 dark:group-hover/tool:bg-green-500 dark:group-hover/tool:text-black">
                          {tool.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="mb-0.5 text-sm font-bold leading-tight text-black normal-case dark:text-white">
                            {navTools?.[tool.key]?.title || humanizeSlug(tool.slug)}
                          </span>
                          <span className="text-[10px] font-medium text-black transition-colors group-hover/tool:text-green-600 dark:text-white dark:group-hover/tool:text-green-500">
                            {navTools?.[tool.key]?.sub || ''}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </Popover>
              )}
            </div>

            {[
              { slug: 'o-nas', href: `/${lang}/o-nas`, label: dict?.about || (lang === 'en' ? 'ABOUT' : 'O NÁS'), active: pathname.includes('/o-nas') },
              { slug: 'kontakt', href: `/${lang}/kontakt`, label: dict?.contact || (lang === 'en' ? 'CONTACT' : 'KONTAKT'), active: pathname.includes('/kontakt') },
            ]
              .filter((item) => isPageEnabled(item.slug) && showInNavbar(item.slug))
              .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 py-2 group whitespace-nowrap ${
                  item.active 
                    ? 'text-green-600' 
                    : 'text-black hover:text-green-600 dark:text-white dark:hover:text-green-500'
                }`}
              >
                {item.label}
                <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-green-600 transition-all duration-300 transform origin-left ${
                  item.active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`} />
              </Link>
            ))}
          </div>

          {/* ACTION BUTTONS */}
            <div className="hidden md:flex items-center gap-2">

            {/* PŘEPÍNAČ JAZYKA */}
            <div className={utilityGroupClass}>
              <Link 
                href={getTransliteratedPath('cs')}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-all ${lang === 'cs' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : 'text-black hover:text-green-600 dark:text-white dark:hover:text-green-500'}`}
              >
                CZ
              </Link>
              <Link 
                href={getTransliteratedPath('en')}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-all ${lang === 'en' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : 'text-black hover:text-green-600 dark:text-white dark:hover:text-green-500'}`}
              >
                EN
              </Link>
            </div>

            <ThemeToggleButton className={utilityButtonClass} />

            {isPageEnabled('prihlaska') && (
              <Link 
                href={`/${lang}/prihlaska`} 
                className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-2xl border-2 border-green-600 bg-green-600 px-5 text-[11px] font-black uppercase tracking-[0.12em] text-white transition-all hover:border-green-500 hover:bg-green-500"
              >
                {lang === 'cs' ? 'Přidej se' : 'Join us'}
              </Link>
            )}
          </div>

          {/* MOBILNÍ HAMBURGER */}
          <div className="md:hidden flex items-center gap-3">
            <ThemeToggleButton className={utilityButtonClass} testId="accessibility-theme-toggle-mobile" />
            <div className={utilityGroupClass}>
              <Link href={getTransliteratedPath('cs')} className={`px-2 py-1 rounded-lg text-[9px] font-black transition focus:ring-2 focus:ring-green-500 focus:outline-none ${lang === 'cs' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : 'text-black hover:text-green-600 dark:text-white dark:hover:text-green-500'}`}>CZ</Link>
              <Link href={getTransliteratedPath('en')} className={`px-2 py-1 rounded-lg text-[9px] font-black transition focus:ring-2 focus:ring-green-500 focus:outline-none ${lang === 'en' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : 'text-black hover:text-green-600 dark:text-white dark:hover:text-green-500'}`}>EN</Link>
            </div>
            
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`${utilityButtonClass} p-2 focus:ring-2 focus:ring-green-500 focus:outline-none`}
              aria-label={isMenuOpen ? "Zavřít menu" : "Otevřít menu"}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILNÍ MENU */}
      {isMenuOpen && (
        <Drawer
          open={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          side="top"
          lockScroll={false}
          overlayClassName="md:hidden fixed inset-0 z-[9998] flex"
          backdropClassName="absolute inset-0 bg-black/40"
          panelClassName="relative w-full mt-16 h-[calc(100dvh-4rem)] bg-white dark:bg-black border-t-2 border-black dark:border-white animate-in slide-in-from-top-10 duration-500 overflow-y-auto overscroll-contain touch-pan-y"
        >
          <div className="flex flex-col p-5 sm:p-8 space-y-5 text-black dark:text-white pb-[max(2rem,env(safe-area-inset-bottom))]">
            {/* MOBILNÍ SEARCH */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-3.5 text-stone-400 dark:text-stone-500" size={20} aria-hidden="true" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full rounded-2xl border-2 border-black bg-white pl-12 pr-4 py-4 text-sm font-bold text-black outline-none transition-all placeholder:text-black dark:border-white dark:bg-black dark:text-white dark:placeholder:text-white focus:ring-2 focus:ring-green-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchQuery.trim().length >= 2) {
                      window.location.href = `/${lang}/search?q=${encodeURIComponent(searchQuery.trim())}`;
                      setIsMenuOpen(false);
                    }
                  }
                }}
              />
              {isSearching && <InlinePulse className="absolute right-5 top-5 bg-stone-300 dark:bg-stone-600" size={14} />}
            </div>

            {searchQuery.trim().length >= 2 && !isSearching && (
              <div className="rounded-2xl border-2 border-black bg-white p-4 dark:border-white dark:bg-black">
                {(searchResults.pages.length > 0 ||
                  searchResults.events.length > 0 ||
                  searchResults.posts.length > 0 ||
                  searchResults.faqs.length > 0 ||
                  searchResults.guide.length > 0 ||
                  searchResults.discounts.length > 0 ||
                  searchResults.books.length > 0 ||
                  searchResults.archive.length > 0) ? (
                  <div className="space-y-4">
                    {searchResults.pages.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-2">{lang === 'en' ? 'Pages' : 'Stránky'}</div>
                        <div className="space-y-1">
                          {searchResults.pages.slice(0, 3).map((p) => (
                            <Link
                              key={p.id || p.href}
                              href={String(p.href || `/${lang}`)}
                              onClick={() => setIsMenuOpen(false)}
                              className="flex items-center gap-3 p-3 bg-white dark:bg-black rounded-2xl hover:bg-green-50 dark:hover:bg-green-950 transition border border-black dark:border-white"
                            >
                              <div className="w-10 h-10 bg-white dark:bg-black rounded-xl flex items-center justify-center border border-black dark:border-white">
                                <FileText size={16} className="text-stone-400 dark:text-stone-500" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-bold text-black dark:text-white truncate">{p.title || p.href}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchResults.events.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-2">Akce</div>
                        <div className="space-y-1">
                          {searchResults.events.slice(0, 3).map((ev) => (
                            <Link
                              key={ev.id}
                              href={`/${lang}/akce/${ev.id}`}
                              onClick={() => setIsMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 bg-white dark:bg-black border border-black dark:border-white hover:bg-green-50 dark:hover:bg-green-950 transition"
                            >
                              <div className="text-sm font-bold text-black dark:text-white truncate">{ev.title}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchResults.posts.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-2">Novinky</div>
                        <div className="space-y-1">
                          {searchResults.posts.slice(0, 3).map((po) => (
                            <Link
                              key={po.id}
                              href={`/${lang}/novinky/${po.id}`}
                              onClick={() => setIsMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 bg-white dark:bg-black border border-black dark:border-white hover:bg-green-50 dark:hover:bg-green-950 transition"
                            >
                              <div className="text-sm font-bold text-black dark:text-white truncate">{po.title}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchResults.faqs.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-2">FAQ</div>
                        <div className="space-y-1">
                          {searchResults.faqs.slice(0, 3).map((f) => (
                            <Link
                              key={f.id}
                              href={`/${lang}/faq?q=${encodeURIComponent(searchQuery.trim())}`}
                              onClick={() => setIsMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 bg-white dark:bg-black border border-black dark:border-white hover:bg-green-50 dark:hover:bg-green-950 transition"
                            >
                              <div className="text-sm font-bold text-black dark:text-white truncate">{f.question}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    <Link
                      href={`/${lang}/search?q=${encodeURIComponent(searchQuery.trim())}`}
                      onClick={() => setIsMenuOpen(false)}
                      className="block text-center text-[10px] font-black uppercase tracking-widest text-green-700 dark:text-green-400 hover:text-green-800"
                    >
                      {lang === 'en' ? 'View all results' : 'Zobrazit všechny výsledky'}
                    </Link>
                  </div>
                ) : (
                  <div className="text-center text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest py-2">
                    {searchNoResults}
                  </div>
                )}
              </div>
            )}

            <Link href={`/${lang}`} onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname === `/${lang}` ? 'text-green-600 dark:text-green-400' : 'text-black dark:text-white'}`}>
              {dict?.home || (lang === 'en' ? 'Home' : 'Domů')}
            </Link>
            {isPageEnabled('akce') && showInNavbar('akce') && (
              <Link
                href={`/${lang}/akce`}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname.includes('/akce') ? 'text-green-600 dark:text-green-400' : 'text-black dark:text-white'}`}
              >
                {dict?.events || (lang === 'en' ? 'Events' : 'Akce')}
              </Link>
            )}
            {isPageEnabled('novinky') && showInNavbar('novinky') && (
              <Link
                href={`/${lang}/novinky`}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname.includes('/novinky') ? 'text-green-600 dark:text-green-400' : 'text-black dark:text-white'}`}
              >
                {dict?.news || (lang === 'en' ? 'News' : 'Novinky')}
              </Link>
            )}
            
            <div className="py-4 border-y border-black dark:border-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-6">
                {toolsTitle}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                {TOOLS.filter((t) => isPageEnabled(t.slug) && showInTools(t.slug)).map((tool) => (
                  <Link 
                    key={tool.href}
                    href={`/${lang}${tool.href}`} 
                    onClick={() => setIsMenuOpen(false)} 
                    className="text-[11px] font-black text-black dark:text-white hover:text-green-600 dark:hover:text-green-400 flex items-center gap-3"
                  >
                    <span className="text-stone-400 dark:text-stone-500">{tool.icon}</span>
                    {navTools?.[tool.key]?.title || humanizeSlug(tool.slug)}
                  </Link>
                ))}
              </div>
            </div>

            {isPageEnabled('o-nas') && showInNavbar('o-nas') && (
              <Link
                href={`/${lang}/o-nas`}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname.includes('/o-nas') ? 'text-green-600 dark:text-green-400' : 'text-black dark:text-white'}`}
              >
                {dict?.about || (lang === 'en' ? 'About' : 'O nás')}
              </Link>
            )}
            {isPageEnabled('kontakt') && showInNavbar('kontakt') && (
              <Link
                href={`/${lang}/kontakt`}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname.includes('/kontakt') ? 'text-green-600 dark:text-green-400' : 'text-black dark:text-white'}`}
              >
                {dict?.contact || (lang === 'en' ? 'Contact' : 'Kontakt')}
              </Link>
            )}

            {isPageEnabled('prihlaska') && (
              <Link 
                href={`/${lang}/prihlaska`} 
                onClick={() => setIsMenuOpen(false)}
                className="bg-green-600 text-white px-6 py-5 rounded-2xl font-black text-center mt-6 border-2 border-green-600 hover:border-green-500"
              >
                {lang === 'cs' ? 'Přidej se k nám' : 'Join us'}
              </Link>
            )}
          </div>
        </Drawer>
      )}
    </nav>
  );
}
