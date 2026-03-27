'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribeClient() {
  const sp = useSearchParams();
  const email = useMemo(() => String(sp.get('email') || '').trim().toLowerCase(), [sp]);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const run = async () => {
    if (!email) return;
    setState('loading');
    setError('');
    try {
      const r = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Chyba');
      setState('done');
    } catch (e: any) {
      setState('error');
      setError(e?.message || 'Chyba');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="bg-white border border-stone-100 shadow-sm rounded-[3rem] p-10 w-full max-w-lg">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Newsletter</div>
        <h1 className="text-3xl font-black text-stone-900 tracking-tight mt-3">Odhlášení odběru</h1>
        <p className="text-stone-500 font-medium mt-4">
          {email ? (
            <>
              Chcete odhlásit e-mail <span className="font-bold text-stone-900">{email}</span>?
            </>
          ) : (
            'Chybí e-mail v odkazu.'
          )}
        </p>

        {state === 'done' ? (
          <div className="mt-8 bg-green-50 text-green-700 rounded-[2rem] p-6 font-bold">Hotovo. Odběr byl odhlášen.</div>
        ) : state === 'error' ? (
          <div className="mt-8 bg-red-50 text-red-700 rounded-[2rem] p-6 font-bold">{error || 'Chyba'}</div>
        ) : (
          <button
            type="button"
            disabled={!email || state === 'loading'}
            onClick={run}
            className="mt-8 w-full bg-stone-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-stone-800 transition disabled:opacity-50"
          >
            {state === 'loading' ? 'Odhlašuji…' : 'Odhlásit'}
          </button>
        )}

        <Link href="/" className="mt-8 inline-block text-stone-400 font-bold hover:text-stone-900 transition text-sm">
          Zpět na web
        </Link>
      </div>
    </div>
  );
}
