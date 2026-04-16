'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, X, Search, Calendar, FileText, 
  ChevronDown, BookOpen, ShieldCheck, Users, Tag, Clock, PenTool, BrainCircuit, Briefcase, HelpCircle, Lock as LockIcon, LogOut, KeyRound, Siren, Archive, LifeBuoy
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import Drawer from '@/app/components/ui/Drawer';
import Popover from '@/app/components/ui/Popover';

interface NavbarProps {
  lang: string;
  dict: any;
}

export default function Navbar({ lang, dict }: NavbarProps) {
  const t = dict && typeof dict === 'object' ? (dict as any) : {};
  const navTools = t?.nav?.tools && typeof t.nav.tools === 'object' ? t.nav.tools : {};
  const toolsTitle = navTools?.dropdownTitle || (lang === 'en' ? 'Tools' : 'Nástroje');
  const searchPlaceholder = t?.common?.searchPlaceholder || (lang === 'en' ? 'Search…' : 'Vyhledat…');
  const navHome = t?.home || (lang === 'en' ? 'Home' : 'Domů');
  const navEvents = t?.events || (lang === 'en' ? 'Events' : 'Akce');
  const navNews = t?.news || (lang === 'en' ? 'News' : 'Novinky');

  const humanizeSlug = (s: string) => String(s || '').replace(/-/g, ' ');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{events: any[], posts: any[], faqs: any[], books: any[], discounts: any[], guide: any[], archive: any[]}>({events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: []});
  const [isSearching, setIsSearching] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sitePages, setSitePages] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    async function getProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          const token = session.access_token;
          const res = await fetch('/api/auth/me-profile', { headers: { Authorization: `Bearer ${token}` } });
          const json = await res.json().catch(() => ({}));
          setUserProfile(res.ok ? (json?.profile || null) : null);
        } catch {
          setUserProfile(null);
        }
      }
    }
    getProfile();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        getProfile();
      } else {
        setUserProfile(null);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

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
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const toolsCloseTimerRef = useRef<number | null>(null);
  const userCloseTimerRef = useRef<number | null>(null);

  const cancelToolsClose = () => {
    if (toolsCloseTimerRef.current) window.clearTimeout(toolsCloseTimerRef.current);
    toolsCloseTimerRef.current = null;
  };
  const scheduleToolsClose = () => {
    cancelToolsClose();
    toolsCloseTimerRef.current = window.setTimeout(() => setIsToolsOpen(false), 120);
  };

  const cancelUserClose = () => {
    if (userCloseTimerRef.current) window.clearTimeout(userCloseTimerRef.current);
    userCloseTimerRef.current = null;
  };
  const scheduleUserClose = () => {
    cancelUserClose();
    userCloseTimerRef.current = window.setTimeout(() => setIsUserMenuOpen(false), 120);
  };

  useEffect(() => {
    setIsMenuOpen(false);
    setIsSearchOpen(false);
    setIsToolsOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  // Search logic
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults({events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: []});
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
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Chyba');
        setSearchResults(json?.results || { events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });
      } catch (err) {
        console.error(err);
        setSearchResults({ events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });
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
    <nav className="sticky top-0 z-[10001] w-full bg-white/90 backdrop-blur-xl border-b border-stone-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          
          {/* LOGO */}
          <Link href={`/${lang}`} className="flex items-center gap-2 sm:gap-3 group shrink-0 mr-4">
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 overflow-hidden rounded-full shadow-sm group-hover:scale-105 transition duration-300">
              <Image 
                src="/logo.png" 
                alt="Logo Spolek Pupen" 
                fill
                className="object-cover"
              />
            </div>
            <span className="hidden sm:inline font-bold text-base sm:text-lg tracking-tight text-stone-900 group-hover:text-green-600 transition truncate max-w-[150px] sm:max-w-none">
              Studentský spolek Pupen, z.s.
            </span>
          </Link>

          {/* DESKTOP MENU */}
          <div className="hidden xl:flex items-center gap-6 font-medium text-[13px] tracking-normal text-stone-600">
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
                    : 'text-stone-500 hover:text-stone-900'
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
              onMouseEnter={() => {
                cancelToolsClose();
                setIsToolsOpen(true);
              }}
              onMouseLeave={() => {
                scheduleToolsClose();
              }}
            >
              <button 
                type="button"
                onClick={() => {
                  cancelToolsClose();
                  setIsToolsOpen((v) => !v);
                }}
                aria-haspopup="menu"
                aria-expanded={isToolsOpen}
                className={`relative group flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 py-2 whitespace-nowrap ${
                  isToolsOpen ? 'text-green-600' : 'text-stone-500 hover:text-stone-900'
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
                  onPanelMouseEnter={cancelToolsClose}
                  onPanelMouseLeave={scheduleToolsClose}
                  panelClassName="w-[520px] bg-white border border-stone-100 shadow-2xl rounded-[2.5rem] p-8 animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {TOOLS.filter((t) => isPageEnabled(t.slug) && showInTools(t.slug)).map((tool) => (
                      <Link 
                        key={tool.href}
                        href={`/${lang}${tool.href}`} 
                        className="flex items-center gap-4 p-4 hover:bg-stone-50 rounded-2xl transition group/tool"
                        onClick={() => setIsToolsOpen(false)}
                      >
                        <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/tool:bg-green-600 group-hover/tool:text-white transition-all duration-300 shadow-sm border border-stone-100">
                          {tool.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-stone-900 leading-tight mb-0.5 normal-case">
                            {navTools?.[tool.key]?.title || humanizeSlug(tool.slug)}
                          </span>
                          <span className="text-[10px] text-stone-400 font-medium group-hover/tool:text-green-600 transition-colors">
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
                    : 'text-stone-500 hover:text-stone-900'
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
          <div className="hidden md:flex items-center gap-4">
            {/* SEARCH */}
            <div className="relative" ref={searchRef}>
              <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`p-2 transition-all duration-300 ${isSearchOpen ? 'text-stone-900' : 'text-stone-400 hover:text-green-600'}`}
              >
                {isSearchOpen ? <X size={20} /> : <Search size={20} />}
              </button>
              {isSearchOpen && (
                <Popover
                  open={isSearchOpen}
                  onClose={() => setIsSearchOpen(false)}
                  anchorRef={searchRef}
                  placement="bottom-end"
                  offset={16}
                  zIndex={10001}
                  panelClassName="w-96 bg-white border border-stone-100 shadow-2xl rounded-3xl p-6 animate-in slide-in-from-top-2 duration-300"
                >
                  <div className="relative mb-6">
                    <input 
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-green-500 transition"
                    />
                    {isSearching && <InlinePulse className="absolute right-5 top-5 bg-stone-200" size={14} />}
                  </div>

                  {(searchResults.events.length > 0 || searchResults.posts.length > 0 || searchResults.faqs.length > 0 || searchResults.guide.length > 0 || searchResults.discounts.length > 0 || searchResults.books.length > 0 || searchResults.archive.length > 0) ? (
                    <div className="space-y-6">
                      {searchResults.events.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 px-2">Akce</p>
                          <div className="space-y-1">
                            {searchResults.events.map(ev => (
                              <Link 
                                key={ev.id}
                                href={`/${lang}/akce/${ev.id}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                              >
                                <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                                  <Calendar size={16} />
                                </div>
                                <span className="text-sm font-bold text-stone-700 truncate">{ev.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchResults.posts.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 px-2">Novinky</p>
                          <div className="space-y-1">
                            {searchResults.posts.map(po => (
                              <Link 
                                key={po.id}
                                href={`/${lang}/novinky/${po.id}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                              >
                                <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                                  <FileText size={16} />
                                </div>
                                <span className="text-sm font-bold text-stone-700 truncate">{po.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchResults.faqs.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 px-2">FAQ</p>
                          <div className="space-y-1">
                            {searchResults.faqs.map(f => (
                              <Link 
                                key={f.id}
                                href={`/${lang}/faq?q=${encodeURIComponent(searchQuery)}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                              >
                                <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                                  <HelpCircle size={16} />
                                </div>
                                <span className="text-sm font-bold text-stone-700 truncate">{f.question}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchResults.guide.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 px-2">{lang === 'en' ? 'Guide' : 'Průvodce'}</p>
                          <div className="space-y-1">
                            {searchResults.guide.map(a => (
                              <Link 
                                key={a.id}
                                href={`/${lang}/pruvodce/${a.slug}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                              >
                                <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                                  <BookOpen size={16} />
                                </div>
                                <span className="text-sm font-bold text-stone-700 truncate">{a.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchResults.discounts.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 px-2">{lang === 'en' ? 'Discounts' : 'Slevy'}</p>
                          <div className="space-y-1">
                            {searchResults.discounts.map(d => (
                              <Link 
                                key={d.id}
                                href={`/${lang}/slevy?q=${encodeURIComponent(searchQuery)}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                              >
                                <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                                  <Tag size={16} />
                                </div>
                                <span className="text-sm font-bold text-stone-700 truncate">{d.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchResults.books.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 px-2">{lang === 'en' ? 'Book exchange' : 'Burza'}</p>
                          <div className="space-y-1">
                            {searchResults.books.map(b => (
                              <Link 
                                key={b.id}
                                href={`/${lang}/burza?q=${encodeURIComponent(searchQuery)}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                              >
                                <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                                  <BookOpen size={16} />
                                </div>
                                <span className="text-sm font-bold text-stone-700 truncate">{b.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchResults.archive.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 px-2">{lang === 'en' ? 'Archive' : 'Archiv'}</p>
                          <div className="space-y-1">
                            {searchResults.archive.map(a => (
                              <Link 
                                key={a.id}
                                href={`/${lang}/archiv?q=${encodeURIComponent(searchQuery)}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                              >
                                <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                                  <Archive size={16} />
                                </div>
                                <span className="text-sm font-bold text-stone-700 truncate">{a.title || (lang === 'en' ? 'Entry' : 'Záznam')}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="pt-2">
                        <Link
                          href={`/${lang}/search?q=${encodeURIComponent(searchQuery)}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="block text-center text-[10px] font-black uppercase tracking-widest text-green-600 hover:text-green-700 transition"
                        >
                          {lang === 'en' ? 'View all results' : 'Zobrazit všechny výsledky'}
                        </Link>
                      </div>
                    </div>
                  ) : searchQuery.length >= 2 && !isSearching && (
                    <div className="text-center py-8">
                      <p className="text-sm text-stone-400 font-bold">{dict?.searchNoResults || "Nic nenalezeno"}</p>
                    </div>
                  )}
                </Popover>
              )}
            </div>

            {/* PŘEPÍNAČ JAZYKA */}
            <div className="flex items-center gap-1 bg-stone-50 p-1 rounded-xl border border-stone-100">
              <Link 
                href={getTransliteratedPath('cs')}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'cs' ? 'bg-white text-green-600 shadow-sm' : 'text-stone-300 hover:text-stone-500'}`}
              >
                CZ
              </Link>
              <Link 
                href={getTransliteratedPath('en')}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? 'bg-white text-green-600 shadow-sm' : 'text-stone-300 hover:text-stone-500'}`}
              >
                EN
              </Link>
            </div>

            <div
              className="relative"
              ref={userMenuRef}
              onMouseEnter={() => {
                cancelUserClose();
                setIsUserMenuOpen(true);
              }}
              onMouseLeave={() => {
                scheduleUserClose();
              }}
            >
              <button
                type="button"
                onClick={() => {
                  cancelUserClose();
                  setIsUserMenuOpen((v) => !v);
                }}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                className="px-3 py-2.5 bg-stone-50 text-stone-500 rounded-xl hover:bg-stone-100 hover:text-stone-900 transition-all border border-stone-100 shadow-sm inline-flex items-center gap-1.5"
                title={userProfile ? (lang === 'cs' ? 'Účet' : 'Account') : (dict?.memberLogin || 'Login')}
              >
                {userProfile ? (
                  <span className="w-5 h-5 flex items-center justify-center font-black text-xs uppercase">
                    {(userProfile?.first_name?.[0] || userProfile?.email?.[0] || 'U') as string}
                  </span>
                ) : (
                  <LockIcon size={20} />
                )}
                <ChevronDown size={14} className={`transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <Popover
                  open={isUserMenuOpen}
                  onClose={() => setIsUserMenuOpen(false)}
                  anchorRef={userMenuRef}
                  placement="bottom-end"
                  offset={12}
                  zIndex={10001}
                  onPanelMouseEnter={cancelUserClose}
                  onPanelMouseLeave={scheduleUserClose}
                  panelClassName="w-64 bg-white border border-stone-100 shadow-2xl rounded-3xl p-2"
                >
                  {(userProfile?.is_member || userProfile?.is_admin || userProfile?.can_manage_admins || userProfile?.can_view_member_portal || userProfile?.can_edit_member_portal) && (
                    <Link
                      href={`/${lang}/clen`}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-stone-50 transition text-stone-700 font-bold"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <ShieldCheck size={18} className="text-blue-600" />
                      <span>{lang === 'cs' ? 'Členský portál' : 'Member Portal'}</span>
                    </Link>
                  )}

                  {(userProfile?.is_admin || userProfile?.can_manage_admins) && (
                    <Link
                      href={`/${lang}/admin/dashboard`}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-stone-50 transition text-stone-700 font-bold"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <LockIcon size={18} className="text-stone-900" />
                      <span>Admin</span>
                    </Link>
                  )}

                  {!userProfile && (
                    <Link
                      href={`/${lang}/login`}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-stone-50 transition text-stone-700 font-bold"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <LockIcon size={18} className="text-stone-900" />
                      <span>{dict?.memberLogin || (lang === 'cs' ? 'Přihlášení' : 'Login')}</span>
                    </Link>
                  )}

                  {userProfile && (
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        window.location.href = `/${lang}/login`;
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 transition text-red-700 font-bold"
                    >
                      <LogOut size={18} className="text-red-600" />
                      <span>{lang === 'cs' ? 'Odhlásit se' : 'Log out'}</span>
                    </button>
                  )}
                </Popover>
              )}
            </div>

            {isPageEnabled('prihlaska') && (
              <Link 
                href={`/${lang}/prihlaska`} 
                className="inline-flex items-center justify-center whitespace-nowrap bg-green-600 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.12em] hover:bg-green-500 transition-all shadow-lg shadow-green-600/20 hover:shadow-green-600/30"
              >
                {lang === 'cs' ? 'Přidej se' : 'Join us'}
              </Link>
            )}
          </div>

          {/* MOBILNÍ HAMBURGER */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
              <Link href={getTransliteratedPath('cs')} className={`px-2 py-1 rounded-lg text-[9px] font-black transition focus:ring-2 focus:ring-green-500 focus:outline-none ${lang === 'cs' ? 'bg-white text-green-600 shadow-sm' : 'text-stone-400'}`}>CZ</Link>
              <Link href={getTransliteratedPath('en')} className={`px-2 py-1 rounded-lg text-[9px] font-black transition focus:ring-2 focus:ring-green-500 focus:outline-none ${lang === 'en' ? 'bg-white text-green-600 shadow-sm' : 'text-stone-400'}`}>EN</Link>
            </div>
            
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-stone-900 hover:text-green-600 transition p-2 bg-stone-100 rounded-xl border border-stone-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
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
          overlayClassName="lg:hidden fixed inset-0 z-[9998] flex"
          backdropClassName="absolute inset-0 bg-black/40 backdrop-blur-sm"
          panelClassName="relative w-full mt-16 h-[calc(100dvh-4rem)] bg-white animate-in slide-in-from-top-10 duration-500 overflow-y-auto overscroll-contain touch-pan-y"
        >
          <div className="flex flex-col p-5 sm:p-8 space-y-5 text-stone-800 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {/* MOBILNÍ SEARCH */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-3.5 text-stone-500" size={20} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-stone-100 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-green-500 transition-all outline-none"
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
              {isSearching && <InlinePulse className="absolute right-5 top-5 bg-stone-300" size={14} />}
            </div>

            {searchQuery.trim().length >= 2 && !isSearching && (
              <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
                {(searchResults.events.length > 0 ||
                  searchResults.posts.length > 0 ||
                  searchResults.faqs.length > 0 ||
                  searchResults.guide.length > 0 ||
                  searchResults.discounts.length > 0 ||
                  searchResults.books.length > 0 ||
                  searchResults.archive.length > 0) ? (
                  <div className="space-y-4">
                    {searchResults.events.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Akce</div>
                        <div className="space-y-1">
                          {searchResults.events.slice(0, 3).map((ev: any) => (
                            <Link
                              key={ev.id}
                              href={`/${lang}/akce/${ev.id}`}
                              onClick={() => setIsMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 bg-white border border-stone-100 hover:border-green-200 hover:bg-green-50 transition"
                            >
                              <div className="text-sm font-bold text-stone-800 truncate">{ev.title}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchResults.posts.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Novinky</div>
                        <div className="space-y-1">
                          {searchResults.posts.slice(0, 3).map((po: any) => (
                            <Link
                              key={po.id}
                              href={`/${lang}/novinky/${po.id}`}
                              onClick={() => setIsMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 bg-white border border-stone-100 hover:border-green-200 hover:bg-green-50 transition"
                            >
                              <div className="text-sm font-bold text-stone-800 truncate">{po.title}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchResults.faqs.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">FAQ</div>
                        <div className="space-y-1">
                          {searchResults.faqs.slice(0, 3).map((f: any) => (
                            <Link
                              key={f.id}
                              href={`/${lang}/faq?q=${encodeURIComponent(searchQuery.trim())}`}
                              onClick={() => setIsMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 bg-white border border-stone-100 hover:border-green-200 hover:bg-green-50 transition"
                            >
                              <div className="text-sm font-bold text-stone-800 truncate">{f.question}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    <Link
                      href={`/${lang}/search?q=${encodeURIComponent(searchQuery.trim())}`}
                      onClick={() => setIsMenuOpen(false)}
                      className="block text-center text-[10px] font-black uppercase tracking-widest text-green-700 hover:text-green-800"
                    >
                      {lang === 'en' ? 'View all results' : 'Zobrazit všechny výsledky'}
                    </Link>
                  </div>
                ) : (
                  <div className="text-center text-xs font-bold text-stone-400 uppercase tracking-widest py-2">
                    {dict?.searchNoResults || (lang === 'en' ? 'No results' : 'Nic nenalezeno')}
                  </div>
                )}
              </div>
            )}

            <Link href={`/${lang}`} onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname === `/${lang}` ? 'text-green-600' : ''}`}>
              {dict?.home || (lang === 'en' ? 'Home' : 'Domů')}
            </Link>
            {isPageEnabled('akce') && showInNavbar('akce') && (
              <Link
                href={`/${lang}/akce`}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname.includes('/akce') ? 'text-green-600' : ''}`}
              >
                {dict?.events || (lang === 'en' ? 'Events' : 'Akce')}
              </Link>
            )}
            {isPageEnabled('novinky') && showInNavbar('novinky') && (
              <Link
                href={`/${lang}/novinky`}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname.includes('/novinky') ? 'text-green-600' : ''}`}
              >
                {dict?.news || (lang === 'en' ? 'News' : 'Novinky')}
              </Link>
            )}
            
            <div className="py-4 border-y border-stone-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-6">
                {toolsTitle}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                {TOOLS.filter((t) => isPageEnabled(t.slug) && showInTools(t.slug)).map((tool) => (
                  <Link 
                    key={tool.href}
                    href={`/${lang}${tool.href}`} 
                    onClick={() => setIsMenuOpen(false)} 
                    className="text-[11px] font-black text-stone-700 hover:text-green-600 flex items-center gap-3"
                  >
                    <span className="text-stone-400">{tool.icon}</span>
                    {navTools?.[tool.key]?.title || humanizeSlug(tool.slug)}
                  </Link>
                ))}
              </div>
            </div>

            {isPageEnabled('o-nas') && showInNavbar('o-nas') && (
              <Link
                href={`/${lang}/o-nas`}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname.includes('/o-nas') ? 'text-green-600' : ''}`}
              >
                {dict?.about || (lang === 'en' ? 'About' : 'O nás')}
              </Link>
            )}
            {isPageEnabled('kontakt') && showInNavbar('kontakt') && (
              <Link
                href={`/${lang}/kontakt`}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] ${pathname.includes('/kontakt') ? 'text-green-600' : ''}`}
              >
                {dict?.contact || (lang === 'en' ? 'Contact' : 'Kontakt')}
              </Link>
            )}

            {userProfile && (
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = `/${lang}/login`;
                }}
                className="flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] text-red-600"
              >
                <LogOut size={20} /> {lang === 'cs' ? 'Odhlásit se' : 'Log out'}
              </button>
            )}

            {!userProfile && (
              <Link 
                href={`/${lang}/login`} 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-4 text-base font-black uppercase tracking-[0.12em] text-stone-500"
              >
                <LockIcon size={20} /> {dict?.memberLogin}
              </Link>
            )}
            
            {isPageEnabled('prihlaska') && (
              <Link 
                href={`/${lang}/prihlaska`} 
                onClick={() => setIsMenuOpen(false)}
                className="bg-green-600 text-white px-6 py-5 rounded-2xl font-black text-center mt-6 shadow-xl shadow-green-600/30"
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
