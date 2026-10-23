'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import NextImage from 'next/image';

export default function GlobalNotFound() {
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
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-6">
      <div className="max-w-3xl w-full text-center">
        <div className="bg-white dark:bg-black p-20 rounded-[3rem] border-2 border-black dark:border-white flex flex-col items-center gap-8">
          <div className="w-20 h-20 rounded-full border-2 border-black dark:border-white animate-pulse" />
          <div className="space-y-4 w-full flex flex-col items-center">
            <div className="h-4 w-24 rounded-full border-2 border-black dark:border-white animate-pulse" />
            <div className="h-16 w-3/4 rounded-2xl border-2 border-black dark:border-white animate-pulse" />
            <div className="h-6 w-1/2 rounded-lg border-2 border-black dark:border-white animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white font-sans flex items-center justify-center p-6">
      <div className="max-w-3xl w-full text-center">
        <div className="bg-white dark:bg-black p-8 md:p-20 rounded-[3rem] border-2 border-black dark:border-white">

          {/* Logo Pupen */}
          <div className="mb-10 flex justify-center">
            <Link href={`/${lang}`} className="transition-transform hover:scale-105 duration-300">
              <div className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-black dark:border-white">
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
              <span className="font-black uppercase tracking-[0.3em] text-[10px] mb-4 px-3 py-1 border-2 border-black dark:border-white rounded-full">
                Error 404
              </span>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-4">
                {dict.title}
              </h1>
            </div>

            <p className="text-lg md:text-xl font-medium leading-relaxed max-w-md mx-auto">
              {dict.description}
            </p>

            <div className="pt-8 flex justify-center">
              <Link
                href={`/${lang}`}
                className="bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white px-8 py-4 rounded-xl font-bold transition-all hover:bg-green-600 hover:text-white hover:border-green-600 dark:hover:bg-green-500 dark:hover:text-black dark:hover:border-green-500 flex items-center gap-3 active:scale-95"
              >
                <ArrowLeft size={20} />
                {dict.backBtn}
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-[11px] font-black uppercase tracking-[0.2em]">
          Studentský spolek Pupen, z.s. &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
