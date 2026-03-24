'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { RefreshCw, ArrowLeft, Trash2 } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  useEffect(() => {
    void error;
  }, [error]);

  const title = lang === 'en' ? 'Something went wrong' : 'Něco se pokazilo';
  const description =
    lang === 'en'
      ? 'Try reloading the page. If the problem persists, come back later.'
      : 'Zkuste stránku znovu načíst. Pokud problém přetrvá, vraťte se později.';
  const retry = lang === 'en' ? 'Try again' : 'Zkusit znovu';
  const backHome = lang === 'en' ? 'Back home' : 'Zpět na web';
  const showDebug =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('vercel.app') || window.location.hostname === 'localhost');

  const clearClientCache = async () => {
    try {
      if (typeof window === 'undefined') return;
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      try {
        localStorage.clear();
      } catch {}
      try {
        sessionStorage.clear();
      } catch {}
      window.location.reload();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] -left-20 w-[40rem] h-[40rem] bg-green-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] -right-20 w-[40rem] h-[40rem] bg-green-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl w-full z-10">
        <div className="bg-white p-8 md:p-20 rounded-[3rem] shadow-2xl shadow-stone-200/50 text-center border border-stone-100">
          <div className="mb-10 flex justify-center">
            <Link href={`/${lang}`} className="relative group transition-transform hover:scale-105 duration-300">
              <div className="absolute -inset-3 bg-green-100 rounded-full blur-lg opacity-40 group-hover:opacity-100 transition duration-500" />
              <Image
                src="/logo.png"
                alt="Logo Spolek Pupen"
                width={56}
                height={56}
                className="rounded-full object-cover shadow-md border-2 border-white relative z-10"
              />
            </Link>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <span className="text-green-600 font-black uppercase tracking-[0.3em] text-[10px] mb-4">
                Error 500
              </span>
              <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter leading-none mb-4">
                {title}
              </h1>
            </div>

            <p className="text-stone-500 text-lg md:text-xl font-medium leading-relaxed max-w-md mx-auto">
              {description}
            </p>

            {error?.digest && (
              <div className="mt-2 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">
                  Kód chyby
                </div>
                <div className="mt-2 inline-flex items-center justify-center rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-black text-stone-700">
                  {error.digest}
                </div>
              </div>
            )}

            {showDebug && (
              <div className="mt-6 text-left mx-auto max-w-xl">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">
                  Debug
                </div>
                <div className="mt-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs font-bold text-stone-700 break-words">
                  {error?.name ? `${error.name}: ` : ''}
                  {error?.message || 'Unknown error'}
                </div>
              </div>
            )}

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="bg-stone-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 flex items-center gap-3 hover:-translate-y-1 active:scale-95"
              >
                <RefreshCw size={20} />
                {retry}
              </button>
              {showDebug && (
                <button
                  type="button"
                  onClick={clearClientCache}
                  className="bg-white text-stone-900 px-8 py-4 rounded-xl font-bold hover:bg-stone-50 transition-all shadow-xl shadow-stone-900/5 flex items-center gap-3 hover:-translate-y-1 active:scale-95 border border-stone-200"
                >
                  <Trash2 size={20} />
                  {lang === 'en' ? 'Clear cache' : 'Vymazat cache'}
                </button>
              )}
              <Link
                href={`/${lang}`}
                className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-green-500 transition-all shadow-xl shadow-green-600/30 flex items-center gap-3 hover:-translate-y-1 active:scale-95"
              >
                <ArrowLeft size={20} />
                {backHome}
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
