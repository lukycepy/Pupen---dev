'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import InlinePulse from '@/app/components/InlinePulse';
import { getDictionary } from '@/lib/get-dictionary';

export default function ForgotPasswordPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [dict, setDict] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getDictionary(lang).then(setDict);
  }, [lang]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang }),
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-stone-100">
        <div className="flex justify-center mb-8">
          <div className="bg-green-50 p-5 rounded-full shadow-inner">
            <ShieldCheck className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">
          {(dict?.auth?.forgot?.title as string) || (lang === 'en' ? 'Forgot password' : 'Zapomenuté heslo')}
        </h1>
        <p className="text-stone-500 mb-10 font-medium">
          {(dict?.auth?.forgot?.subtitle as string) ||
            (lang === 'en'
              ? 'Enter your email and we will send you a link to set a new password.'
              : 'Zadejte e-mail a pošleme vám odkaz pro nastavení nového hesla.')}
        </p>

        {done ? (
          <div className="bg-green-50 border border-green-100 rounded-[2rem] p-6 text-left">
            <div className="text-green-700 font-black uppercase tracking-widest text-[10px]">
              {(dict?.auth?.forgot?.doneLabel as string) || (lang === 'en' ? 'Done' : 'Hotovo')}
            </div>
            <div className="text-stone-700 font-bold mt-2">
              {(dict?.auth?.forgot?.doneText as string) ||
                (lang === 'en'
                  ? 'If the account exists, you will receive an email shortly.'
                  : 'Pokud účet existuje, brzy vám dorazí e-mail.')}
            </div>
            <Link href={`/${lang}/login`} className="inline-flex mt-6 text-sm font-bold text-green-700 hover:text-green-600 transition">
              {(dict?.auth?.forgot?.backToLogin as string) || (lang === 'en' ? 'Back to login' : 'Zpět na přihlášení')}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                {(dict?.auth?.forgot?.emailLabel as string) || (lang === 'en' ? 'Email' : 'E-mail')}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder={(dict?.auth?.forgot?.emailPlaceholder as string) || 'vas@email.cz'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 transition shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {loading ? <InlinePulse className="bg-white/80" size={14} /> : <ShieldCheck size={18} />}
              {loading
                ? ((dict?.auth?.forgot?.sending as string) || (lang === 'en' ? 'Sending...' : 'Odesílám...'))
                : ((dict?.auth?.forgot?.send as string) || (lang === 'en' ? 'Send link' : 'Poslat odkaz'))}
            </button>

            <div className="pt-6 text-center">
              <Link href={`/${lang}/login`} className="text-stone-400 text-sm font-bold hover:text-green-600 transition">
                {(dict?.auth?.forgot?.backToLogin as string) || (lang === 'en' ? 'Back to login' : 'Zpět na přihlášení')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
