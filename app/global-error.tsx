'use client';

import React, { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Root-level error boundary. Zachytí chyby, které by jinak shodily celý
 * root layout (musí proto sám vykreslit <html> i <body>).
 * Drží binární black/white paletu projektu.
 */
export default function GlobalError({
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
    if (typeof window !== 'undefined') {
      // ChunkLoadError po novém nasazení – jednou zkusíme tvrdý reload.
      const message = (error?.message || '').toLowerCase();
      if (
        error?.name === 'ChunkLoadError' ||
        message.includes('failed to load chunk') ||
        message.includes('dynamically imported module')
      ) {
        const reloaded = sessionStorage.getItem('chunk_reloaded');
        if (!reloaded) {
          sessionStorage.setItem('chunk_reloaded', 'true');
          window.location.reload();
        }
      }
    }
  }, [error]);

  return (
    <html lang="cs">
      <body className="min-h-screen bg-white text-black dark:bg-black dark:text-white font-sans antialiased">
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-3xl bg-white dark:bg-black border-2 border-black dark:border-white rounded-[3rem] p-8 md:p-20 text-center">
            <span className="inline-block font-black uppercase tracking-[0.3em] text-[10px] mb-6 px-3 py-1 border-2 border-black dark:border-white rounded-full">
              Error 500
            </span>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-4">
              Něco se pokazilo
            </h1>
            <p className="text-lg md:text-xl font-medium leading-relaxed max-w-md mx-auto mb-10">
              Zkuste stránku znovu načíst. Pokud problém přetrvá, vraťte se později.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white px-8 py-4 rounded-xl font-bold transition-all hover:bg-green-600 hover:border-green-600 dark:hover:bg-green-500 dark:hover:border-green-500 dark:hover:text-black active:scale-95"
              >
                Zkusit znovu
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.href = '/';
                }}
                className="bg-white text-black dark:bg-black dark:text-white border-2 border-black dark:border-white px-8 py-4 rounded-xl font-bold transition-all hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-600 dark:hover:border-green-500 active:scale-95"
              >
                Zpět na web
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
