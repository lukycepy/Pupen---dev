import React, { Suspense } from 'react';
import UnsubscribeClient from './UnsubscribeClient';

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="bg-white border border-stone-100 shadow-sm rounded-[3rem] p-10 w-full max-w-lg">
            <div className="text-stone-500 font-bold">Načítám…</div>
          </div>
        </div>
      }
    >
      <UnsubscribeClient />
    </Suspense>
  );
}
