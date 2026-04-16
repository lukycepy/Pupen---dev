'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribeClient() {
  const sp = useSearchParams();
  const email = useMemo(() => String(sp.get('email') || '').trim().toLowerCase(), [sp]);
  const campaignId = useMemo(() => String(sp.get('n') || '').trim(), [sp]);
  const variant = useMemo(() => String(sp.get('v') || '').trim(), [sp]);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [reason, setReason] = useState('too_many');
  const [detail, setDetail] = useState('');

  const run = async () => {
    if (!email) return;
    setState('loading');
    setError('');
    try {
      const r = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          reason,
          detail: reason === 'other' ? detail : '',
          campaignId,
          variant,
          source: 'unsubscribe_page',
        }),
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
          <>
            <div className="mt-8 bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2">Důvod odhlášení</div>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
              >
                <option value="too_many">Chodí toho moc</option>
                <option value="not_relevant">Obsah není pro mě</option>
                <option value="never_subscribed">Nikdy jsem se nepřihlásil/a</option>
                <option value="spam">Je to spam</option>
                <option value="other">Jiný důvod</option>
              </select>

              {reason === 'other' ? (
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Napište prosím krátce důvod…"
                  className="mt-3 w-full bg-white border border-stone-200 rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition min-h-[110px]"
                />
              ) : null}
            </div>

            <button
              type="button"
              disabled={!email || state === 'loading' || (reason === 'other' && !detail.trim())}
              onClick={run}
              className="mt-4 w-full bg-stone-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-stone-800 transition disabled:opacity-50"
            >
              {state === 'loading' ? 'Odhlašuji…' : 'Odhlásit'}
            </button>
          </>
        )}

        <Link href="/" className="mt-8 inline-block text-stone-400 font-bold hover:text-stone-900 transition text-sm">
          Zpět na web
        </Link>
      </div>
    </div>
  );
}
