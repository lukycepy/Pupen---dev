'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Lock, Leaf, ShieldCheck, Mail, Key, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/get-dictionary';
import Link from 'next/link';
import InlinePulse from '@/app/components/InlinePulse';
import PasswordField from '@/app/components/PasswordField';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dict, setDict] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  useEffect(() => {
    async function loadDict() {
      const d = await getDictionary(lang);
      setDict(d.adminLogin || {});
    }
    loadDict();
  }, [lang]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        
        handleRedirect(profile, session.user.email);
      }
    };
    checkSession();
  }, [router, lang]);

  const handleRedirect = (profile: any, email?: string) => {
    const isSuperAdmin = email === 'cepelak@pupen.org' || profile?.email === 'cepelak@pupen.org';
    const hasAdmin = profile?.is_admin || isSuperAdmin;
    const hasMember = profile?.is_member || isSuperAdmin;

    if (hasAdmin && hasMember) {
      setUserProfile(profile || { email: 'cepelak@pupen.org' });
      setShowRoleSelection(true);
    } else if (hasAdmin) {
      router.replace(`/${lang}/admin/dashboard`);
    } else if (hasMember) {
      router.replace(`/${lang}/clen`);
    } else {
      setError(lang === 'cs' ? 'Váš účet nemá přístup do chráněných sekcí.' : 'Your account has no access to protected sections.');
      supabase.auth.signOut();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(lang === 'cs' ? 'Chyba přihlášení. Zkontrolujte údaje.' : 'Login error. Please check your credentials.');
      setLoading(false);
    } else if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      
      handleRedirect(profile, data.user.email);
    }
  };

  if (showRoleSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-lg text-center border border-stone-100 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">
            {lang === 'cs' ? 'Vyberte sekci' : 'Select Section'}
          </h1>
          <p className="text-stone-500 mb-10 font-medium">
            {lang === 'cs' ? 'Máte přístup do více částí portálu Pupen.' : 'You have access to multiple parts of the Pupen portal.'}
          </p>
          
          <div className="grid gap-4">
            <button
              onClick={() => router.push(`/${lang}/admin/dashboard`)}
              className="group flex items-center justify-between p-6 bg-stone-900 text-white rounded-[2rem] hover:bg-green-600 transition-all duration-300 shadow-xl shadow-stone-900/20"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl">
                  <Lock size={24} />
                </div>
                <div className="text-left">
                  <p className="font-black uppercase tracking-widest text-[10px] opacity-60">Control Panel</p>
                  <p className="text-xl font-bold">Pupen Control</p>
                </div>
              </div>
              <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>

            <button
              onClick={() => router.push(`/${lang}/clen`)}
              className="group flex items-center justify-between p-6 bg-white text-stone-900 rounded-[2rem] border-2 border-stone-100 hover:border-green-500 hover:text-green-600 transition-all duration-300 shadow-lg shadow-stone-200/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-stone-50 rounded-xl group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                  <ShieldCheck size={24} />
                </div>
                <div className="text-left">
                  <p className="font-black uppercase tracking-widest text-[10px] text-stone-400">Member Section</p>
                  <p className="text-xl font-bold">{lang === 'cs' ? 'Členský portál' : 'Member Portal'}</p>
                </div>
              </div>
              <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>
          </div>

          <button 
            onClick={() => supabase.auth.signOut().then(() => setShowRoleSelection(false))}
            className="mt-10 text-stone-400 font-bold hover:text-red-500 transition text-sm"
          >
            {lang === 'cs' ? 'Odhlásit se' : 'Log out'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-stone-100">
        <div className="flex justify-center mb-8">
          <div className="bg-green-50 p-5 rounded-full shadow-inner">
            <Leaf className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">
          {lang === 'cs' ? 'Vítejte zpět' : 'Welcome back'}
        </h1>
        <p className="text-stone-500 mb-10 font-medium">
          {lang === 'cs' ? 'Přihlášení do ekosystému Pupen' : 'Log in to the Pupen ecosystem'}
        </p>
        
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
              {lang === 'cs' ? 'E-mail' : 'Email'}
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? 'true' : 'false'}
                className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="vas@email.cz"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
              {lang === 'cs' ? 'Heslo' : 'Password'}
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
              <PasswordField
                value={password}
                onChange={setPassword}
                required
                ariaInvalid={!!error}
                placeholder="••••••••"
                inputClassName="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-12 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                buttonClassName="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-700 transition"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 animate-shake">
              <p className="text-red-600 text-xs font-bold text-center">
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 transition shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
          >
            {loading ? <InlinePulse className="bg-white/80" size={14} /> : <Lock size={18} />}
            {loading ? (lang === 'cs' ? 'Přihlašuji...' : 'Logging in...') : (lang === 'cs' ? 'Přihlásit se' : 'Log in')}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-stone-50">
          <Link href={`/${lang}/prihlaska`} className="text-stone-400 text-sm font-bold hover:text-green-600 transition">
            {lang === 'cs' ? 'Ještě nemáte účet? Podat přihlášku' : 'No account yet? Apply here'}
          </Link>
        </div>
      </div>
    </div>
  );
}
