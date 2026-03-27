'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import PasswordField from '@/app/components/PasswordField';
import Link from 'next/link';
import { getDictionary } from '@/lib/get-dictionary';
import { supabase } from '@/lib/supabase';
import { evaluatePassword, passwordScoreLabel } from '@/lib/auth/password-policy';

export default function ResetPasswordClient({ lang }: { lang: string }) {
  const search = useSearchParams();
  const router = useRouter();
  const [dict, setDict] = useState<any>(null);

  const token = useMemo(() => String(search.get('token') || ''), [search]);
  const code = useMemo(() => String(search.get('code') || ''), [search]);
  const accessToken = useMemo(() => String(search.get('access_token') || ''), [search]);
  const refreshToken = useMemo(() => String(search.get('refresh_token') || ''), [search]);
  const type = useMemo(() => String(search.get('type') || ''), [search]);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    getDictionary(lang).then(setDict);
  }, [lang]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (token) return;
        if (code) {
          const res: any = await (supabase.auth as any).exchangeCodeForSession?.(code);
          if (res?.error) throw res.error;
          if (mounted) setRecoveryReady(true);
          return;
        }
        if ((type === 'recovery' || type === 'signup' || type === 'magiclink' || type === 'invite') && accessToken) {
          const res: any = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' });
          if (res?.error) throw res.error;
          if (mounted) setRecoveryReady(true);
          return;
        }
      } catch {
        if (mounted) setRecoveryReady(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accessToken, code, refreshToken, token, type]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const t = dict?.auth?.reset || {};
    if (!token && !recoveryReady) return setError((t.errorMissingToken as string) || (lang === 'en' ? 'Missing token.' : 'Chybí token.'));
    const pw = evaluatePassword(password);
    if (!pw.ok) return setError(lang === 'en' ? 'Password does not meet policy.' : 'Heslo nesplňuje požadavky.');
    if (password !== password2) return setError((t.errorMismatch as string) || (lang === 'en' ? 'Passwords do not match.' : 'Hesla se neshodují.'));

    setLoading(true);
    try {
      if (token) {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Error');
      } else {
        const res = await supabase.auth.updateUser({ password });
        if (res.error) throw res.error;
      }
      setDone(true);
      setTimeout(() => router.replace(`/${lang}/login`), 800);
    } catch (e: any) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-stone-100">
        <div className="flex justify-center mb-8">
          <div className="bg-green-50 p-5 rounded-full shadow-inner">
            <KeyRound className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">
          {(dict?.auth?.reset?.title as string) || (lang === 'en' ? 'Set a new password' : 'Nastavit nové heslo')}
        </h1>
        <p className="text-stone-500 mb-10 font-medium">
          {(dict?.auth?.reset?.subtitle as string) || (lang === 'en' ? 'Choose a strong password.' : 'Zvolte si silné heslo.')}
        </p>

        {done ? (
          <div className="bg-green-50 border border-green-100 rounded-[2rem] p-6 text-left">
            <div className="text-green-700 font-black uppercase tracking-widest text-[10px]">
              {(dict?.auth?.reset?.updatedLabel as string) || (lang === 'en' ? 'Updated' : 'Změněno')}
            </div>
            <div className="text-stone-700 font-bold mt-2">
              {(dict?.auth?.reset?.updatedText as string) || (lang === 'en' ? 'Password updated. Redirecting…' : 'Heslo změněno. Přesměrovávám…')}
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                {(dict?.auth?.reset?.newPassword as string) || (lang === 'en' ? 'New password' : 'Nové heslo')}
              </label>
              <PasswordField
                value={password}
                onChange={setPassword}
                required
                ariaInvalid={!!error}
                placeholder="••••••••"
                inputClassName="w-full bg-stone-50 border-none rounded-2xl px-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                buttonClassName="hidden"
                autoComplete="new-password"
              />
              {password ? (
                <div className="pt-2">
                  {(() => {
                    const r = evaluatePassword(password);
                    const score = r.score;
                    const label = passwordScoreLabel(score, lang === 'en' ? 'en' : 'cs');
                    const pct = (score / 4) * 100;
                    const bar = score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-green-500' : 'bg-green-600';
                    return (
                      <>
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                          <span>{lang === 'cs' ? 'Síla hesla' : 'Password strength'}</span>
                          <span className="text-stone-500">{label}</span>
                        </div>
                        <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div className={`h-2 ${bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                {(dict?.auth?.reset?.confirmPassword as string) || (lang === 'en' ? 'Confirm password' : 'Potvrzení hesla')}
              </label>
              <PasswordField
                value={password2}
                onChange={setPassword2}
                required
                ariaInvalid={!!error}
                placeholder="••••••••"
                inputClassName="w-full bg-stone-50 border-none rounded-2xl px-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                buttonClassName="hidden"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-red-600 text-xs font-bold text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 transition shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {loading ? <InlinePulse className="bg-white/80" size={14} /> : <ShieldCheck size={18} />}
              {loading
                ? ((dict?.auth?.reset?.saving as string) || (lang === 'en' ? 'Saving...' : 'Ukládám...'))
                : ((dict?.auth?.reset?.save as string) || (lang === 'en' ? 'Save password' : 'Uložit heslo'))}
            </button>

            <div className="pt-6 text-center">
              <Link href={`/${lang}/login`} className="text-stone-400 text-sm font-bold hover:text-green-600 transition">
                {(dict?.auth?.reset?.backToLogin as string) || (lang === 'en' ? 'Back to login' : 'Zpět na přihlášení')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
