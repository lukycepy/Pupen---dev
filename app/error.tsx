'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Sentry from '@sentry/nextjs';
import { RefreshCw, ArrowLeft, Trash2 } from 'lucide-react';

/**
 * Kořenová error boundary pro segmenty, které nejsou pod /[lang]
 * (např. /unsubscribe, /offline). Pro jazykové routy platí
 * `app/[lang]/error.tsx`, který bývá blíž a má přednost.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  useEffect(() => {
    // Auto-reload při ChunkLoadError po novém nasazení (zastaralé chunky).
    if (
      error?.name === 'ChunkLoadError' ||
      error?.message?.toLowerCase().includes('failed to load chunk') ||
      error?.message?.toLowerCase().includes('dynamically imported module') ||
      error?.message?.toLowerCase().includes('fetch dynamically imported module')
    ) {
      if (typeof window !== 'undefined') {
        const reloaded = sessionStorage.getItem('chunk_reloaded');
        if (!reloaded) {
          sessionStorage.setItem('chunk_reloaded', 'true');
          window.location.reload();
          return;
        }
      }
    }
  }, [error]);

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
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white font-sans flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="bg-white dark:bg-black p-8 md:p-20 rounded-[3rem] border-2 border-black dark:border-white text-center">
          <div className="mb-10 flex justify-center">
            <Link href="/" className="transition-transform hover:scale-105 duration-300">
              <Image
                src="/logo.png"
                alt="Logo Spolek Pupen"
                width={56}
                height={56}
                className="rounded-full object-cover border-2 border-black dark:border-white"
              />
            </Link>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <span className="font-black uppercase tracking-[0.3em] text-[10px] mb-4 px-3 py-1 border-2 border-black dark:border-white rounded-full">
                Error 500
              </span>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-4">
                Něco se pokazilo
              </h1>
            </div>

            <p className="text-lg md:text-xl font-medium leading-relaxed max-w-md mx-auto">
              Zkuste stránku znovu načíst. Pokud problém přetrvá, vraťte se později.
            </p>

            {error?.digest && (
              <div className="mt-2 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.3em]">Kód chyby</div>
                <div className="mt-2 inline-flex items-center justify-center rounded-xl border-2 border-black dark:border-white px-4 py-2 text-xs font-black">
                  {error.digest}
                </div>
              </div>
            )}

            {showDebug && (
              <div className="mt-6 text-left mx-auto max-w-xl">
                <div className="text-[10px] font-black uppercase tracking-[0.3em]">Debug</div>
                <div className="mt-2 rounded-2xl border-2 border-black dark:border-white px-4 py-3 text-xs font-bold break-words">
                  {error?.name ? `${error.name}: ` : ''}
                  {error?.message || 'Unknown error'}
                </div>
              </div>
            )}

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white px-8 py-4 rounded-xl font-bold transition-all hover:bg-green-600 hover:text-white hover:border-green-600 dark:hover:bg-green-500 dark:hover:text-black dark:hover:border-green-500 flex items-center gap-3 active:scale-95"
              >
                <RefreshCw size={20} />
                Zkusit znovu
              </button>
              {showDebug && (
                <button
                  type="button"
                  onClick={clearClientCache}
                  className="bg-white text-black dark:bg-black dark:text-white border-2 border-black dark:border-white px-8 py-4 rounded-xl font-bold transition-all hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-600 dark:hover:border-green-500 flex items-center gap-3 active:scale-95"
                >
                  <Trash2 size={20} />
                  Vymazat cache
                </button>
              )}
              <Link
                href="/"
                className="bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white px-8 py-4 rounded-xl font-bold transition-all hover:bg-green-600 hover:text-white hover:border-green-600 dark:hover:bg-green-500 dark:hover:text-black dark:hover:border-green-500 flex items-center gap-3 active:scale-95"
              >
                <ArrowLeft size={20} />
                Zpět na web
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
