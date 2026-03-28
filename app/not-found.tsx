'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import NextImage from 'next/image';
import Skeleton from './[lang]/components/Skeleton';

export default function GlobalNotFound() {
  const pathname = usePathname();
  const [dict, setDict] = useState<any>(null);
  
  // Detekce jazyka z URL nebo cookie
  const [lang, setLang] = useState<'cs' | 'en'>('cs');

  useEffect(() => {
    const urlLang = window.location.pathname.split('/')[1];
    if (urlLang === 'en' || urlLang === 'cs') {
      setLang(urlLang);
    } else {
      // Try to get from cookie
      const cookieLang = document.cookie
        .split('; ')
        .find(row => row.startsWith('NEXT_LOCALE='))
        ?.split('=')[1];
      
      if (cookieLang === 'en' || cookieLang === 'cs') {
        setLang(cookieLang);
      }
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      const dictionary = await getDictionary(lang);
      setDict(dictionary.notFound);
    }
    loadData();
  }, [lang]);

  if (!dict) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="bg-white p-20 rounded-[3rem] shadow-2xl border border-stone-100 flex flex-col items-center gap-8">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="space-y-4 w-full flex flex-col items-center">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="h-6 w-1/2 rounded-lg" />
          </div>
          <Skeleton className="h-14 w-48 rounded-xl" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-[-10%] -left-20 w-[40rem] h-[40rem] bg-green-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] -right-20 w-[40rem] h-[40rem] bg-green-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl w-full z-10 text-center">
        <div className="bg-white p-8 md:p-20 rounded-[3rem] shadow-2xl shadow-stone-200/50 border border-stone-100 relative group">
          
          {/* Logo Pupen */}
          <div className="mb-10 flex justify-center">
            <Link href={`/${lang}`} className="relative group transition-transform hover:scale-105 duration-300">
              <div className="absolute -inset-3 bg-green-100 rounded-full blur-lg opacity-40 group-hover:opacity-100 transition duration-500" />
              <div className="relative h-14 w-14 rounded-full overflow-hidden shadow-md border-2 border-white z-10 bg-white">
                <NextImage 
                  src="/logo.png" 
                  alt="Logo Spolek Pupen" 
                  fill
                  className="object-cover"
                />
              </div>
            </Link>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <span className="text-green-600 font-black uppercase tracking-[0.3em] text-[10px] mb-4">
                Error 404
              </span>
              <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter leading-none mb-4">
                {dict.title}
              </h1>
            </div>
            
            <p className="text-stone-500 text-lg md:text-xl font-medium leading-relaxed max-w-md mx-auto">
              {dict.description}
            </p>

            <div className="pt-8 flex justify-center">
              <Link 
                href={`/${lang}`} 
                className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-green-500 transition-all shadow-xl shadow-green-600/30 flex items-center gap-3 hover:-translate-y-1 active:scale-95"
              >
                <ArrowLeft size={20} />
                {dict.backBtn}
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-stone-400 text-[11px] font-black uppercase tracking-[0.2em] opacity-60">
          Studentský spolek Pupen, z.s. &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
