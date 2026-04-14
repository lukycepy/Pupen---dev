'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowRight, Newspaper, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/get-dictionary';
import Skeleton from '../components/Skeleton';
import { richTextToClientHtml } from '@/lib/richtext-client';
import { stripHtmlToText } from '@/lib/richtext-shared';

const passthroughLoader = ({ src }: { src: string }) => src;

export default function NovinkyPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const isSafeImageSrc = (value: unknown) => {
    if (typeof value !== 'string') return false;
    if (!value) return false;
    if (value.startsWith('/')) return true;
    return /^https?:\/\//.test(value);
  };
  const scrollRef = useRef<HTMLDivElement>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dict, setDict] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState("Vše");
  const [scrollProgress, setScrollProgress] = useState(0);

  // Stavy pro skrytí šipek
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 1. NEJDŘÍVE definujeme filteredPosts, aby byly dostupné pro useEffecty níže
  const filteredPosts = activeCategory === "Vše" 
    ? posts 
    : posts.filter(post => post.category === activeCategory);

  const blogCategoryKeys = ["Vše", "Zprávy", "Reportáž", "Oznámení", "Ostatní", "Changelog", "Release notes"];

  // Načtení dat
  useEffect(() => {
    async function loadData() {
      try {
        const dictionary = await getDictionary(lang);
        setDict(dictionary.newsPage || dictionary.news); // Zkusit oba klíče pro jistotu

        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .not('published_at', 'is', null)
          .lte('published_at', nowIso)
          .order('published_at', { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (err) {
        console.error('Chyba při načítání:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [lang]);

  // Kontrola, zda je kam scrollovat
  const checkScroll = () => {
    const slider = scrollRef.current;
    if (!slider) return;

    const { scrollLeft, scrollWidth, clientWidth } = slider;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(scrollLeft / maxScroll);
    }
  };

  // 2. TEĎ už můžeme filteredPosts bezpečně sledovat
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(checkScroll, 100);
      return () => clearTimeout(timer);
    }
  }, [filteredPosts, loading]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth : clientWidth;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!dict && loading) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24 selection:bg-green-100 selection:text-green-900 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* --- HEADER --- */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
             <div className="p-2 bg-green-100 rounded-xl text-green-600 shadow-sm">
                <Newspaper size={20} />
             </div>
             <span className="text-green-600 font-black uppercase tracking-[0.2em] text-[10px]">{dict?.title || (lang === 'cs' ? 'Novinky' : 'News')}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter leading-none text-center md:text-left">
            {dict?.subtitle || (lang === 'cs' ? 'Sleduj nejnovější dění' : 'Follow latest events')}
          </h1>
        </header>

        {/* --- FILTRY --- */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-16">
          <nav className="flex flex-wrap gap-2 justify-center md:justify-start">
            {blogCategoryKeys.map((catKey) => (
              <button
                key={catKey}
                onClick={() => {
                  setActiveCategory(catKey);
                  setScrollProgress(0);
                  scrollRef.current?.scrollTo({ left: 0 });
                }}
                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  activeCategory === catKey 
                    ? "bg-green-600 text-white shadow-lg shadow-green-100 scale-105" 
                    : "bg-white text-stone-500 border border-stone-100 hover:border-stone-200"
                }`}
              >
                {dict?.categories?.[catKey] || catKey}
              </button>
            ))}
          </nav>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[2.5rem] border border-stone-100 p-2 overflow-hidden shadow-sm">
                <Skeleton className="h-52 w-full rounded-t-[2.2rem]" />
                <div className="p-8 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-stone-200 shadow-inner">
             <Search className="mx-auto mb-6 text-stone-200" size={48} />
             <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">{dict?.emptyText}</p>
          </div>
        ) : (
          <div className="relative px-2">
            <h2 className="text-2xl font-black text-stone-900 mb-8 flex items-center gap-3">
               <div className="w-1.5 h-8 bg-green-600 rounded-full" />
               {dict?.latestTitle || (lang === 'cs' ? 'Nejnovější články' : 'Latest articles')}
            </h2>
            
            {/* --- ŠIPKY --- */}
            {canScrollLeft && (
              <button 
                onClick={() => scroll('left')} 
                className="absolute left-0 top-[40%] -translate-y-1/2 -translate-x-2 md:-translate-x-6 z-20 p-4 rounded-full bg-white/90 backdrop-blur-md border border-stone-100 shadow-xl text-stone-800 hover:bg-green-600 hover:text-white transition-all duration-300 group active:scale-90 hidden sm:flex"
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {canScrollRight && (
              <button 
                onClick={() => scroll('right')} 
                className="absolute right-0 top-[40%] -translate-y-1/2 translate-x-2 md:translate-x-6 z-20 p-4 rounded-full bg-white/90 backdrop-blur-md border border-stone-100 shadow-xl text-stone-800 hover:bg-green-600 hover:text-white transition-all duration-300 group active:scale-90 hidden sm:flex"
              >
                <ChevronRight size={28} />
              </button>
            )}

            {/* --- SLIDER --- */}
            <div 
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-12 scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filteredPosts.map((post) => (
                <article 
                  key={post.id} 
                  className="min-w-[85vw] md:min-w-[calc(33.333%-1rem)] snap-start bg-white rounded-[2.5rem] border border-stone-100 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_40px_100px_-30px_rgba(0,0,0,0.1)] transition-all duration-500 group flex flex-col"
                >
                  <div className="h-52 overflow-hidden rounded-t-[2.5rem] relative">
                    {isSafeImageSrc(String(post.image_url ?? '')) ? (
                      String(post.image_url).startsWith('http') ? (
                        <Image
                          loader={passthroughLoader}
                          unoptimized
                          src={String(post.image_url)}
                          alt={post.title}
                          fill
                          className="object-cover transition duration-700 group-hover:scale-110"
                          sizes="(max-width: 768px) 85vw, 33vw"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Image
                          src={post.image_url}
                          fill
                          className="object-cover transition duration-700 group-hover:scale-110"
                          alt={post.title}
                        />
                      )
                    ) : (
                      <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-300"><Newspaper size={40} /></div>
                    )}
                    <div className="absolute top-5 left-5 flex gap-2">
                      <span className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-green-600 shadow-sm border border-white">
                        {dict?.categories?.[post.category] || post.category}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-8 flex flex-col flex-grow">
                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-stone-400 mb-4">
                      <span>{new Date(post.published_at || post.created_at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US')}</span>
                      <span className="w-1.5 h-1.5 bg-stone-200 rounded-full" />
                      <span>
                        {Math.ceil(stripHtmlToText(richTextToClientHtml(String(post.content || ''))).length / 1000)} {dict?.readingTime || 'min čtení'}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-black text-stone-900 leading-tight mb-4 group-hover:text-green-600 transition-colors line-clamp-2">
                      {lang === 'en' && post.title_en ? post.title_en : post.title}
                    </h3>
                    
                    <p className="text-stone-500 text-xs mb-8 line-clamp-3 leading-relaxed font-medium">
                      {stripHtmlToText(richTextToClientHtml(String(lang === 'en' && post.excerpt_en ? post.excerpt_en : post.excerpt || '')))}
                    </p>

                    <div className="mt-auto flex items-center justify-between">
                      <Link 
                        href={`/${lang}/novinky/${post.id}`}
                        className="flex items-center gap-2 text-stone-900 font-black uppercase tracking-widest text-[10px] hover:text-green-600 transition group/btn"
                      >
                        {dict?.readMore} <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* --- PROGRESS BAR --- */}
            <div className="mt-8 flex flex-col items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-48 h-2 bg-stone-200 rounded-full relative border border-stone-100 px-1 flex items-center">
                  <div className="absolute inset-0 flex justify-between items-center px-2 pointer-events-none">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-1 h-1 rounded-full ${
                          (scrollProgress * 100) >= (i * 25) ? 'bg-white/40' : 'bg-stone-400/30'
                        }`}
                      />
                    ))}
                  </div>
                  <div 
                    className="h-1.5 bg-green-600 rounded-full transition-all duration-300 ease-out z-10"
                    style={{ width: `${Math.max(5, scrollProgress * 100)}%` }}
                  />
                </div>
                <div className="bg-green-600 text-white px-3 py-1 rounded-lg shadow-sm">
                   <span className="text-[10px] font-black tabular-nums">
                      {Math.round(scrollProgress * 100)} %
                   </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
