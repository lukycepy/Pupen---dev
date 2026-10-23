import React, { Suspense } from 'react';
import UnsubscribeClient from './UnsubscribeClient';

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-6">
          <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-[3rem] p-10 w-full max-w-lg">
            <div className="text-black dark:text-white font-bold">Načítám…</div>
          </div>
        </div>
      }
    >
      <UnsubscribeClient />
    </Suspense>
  );
}
