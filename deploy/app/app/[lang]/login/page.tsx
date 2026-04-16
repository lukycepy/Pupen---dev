'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Lock, Leaf, ShieldCheck, Mail, Key, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/get-dictionary';
import Link from 'next/link';
import InlinePulse from '@/app/components/InlinePulse';
import PasswordField from '@/app/components/PasswordField';
import Image from 'next/image';

export default function LoginPage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const googleAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfa, setMfa] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [adminMfaEnroll, setAdminMfaEnroll] = useState(false);
  const [adminMfaEnrollQr, setAdminMfaEnrollQr] = useState('');
  const [adminMfaFactorId, setAdminMfaFactorId] = useState('');
  const [adminMfaEnrollCode, setAdminMfaEnrollCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [dict, setDict] = useState<any>(null);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const handleRedirectRef = useRef<((profile: any, email?: string, method?: string) => Promise<void>) | null>(null);
  
  const router = useRouter();
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  const logSecurity = useCallback(async (event: string, details: any) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch('/api/auth/security-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event, details }),
      });
    } catch {}
  }, []);

  useEffect(() => {
    async function loadDict() {
      const d = await getDictionary(lang);
      setDict(d || {});
    }
    loadDict();
  }, [lang]);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    const w: any = window as any;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const el = document.getElementById('turnstile-login');
      if (!el) return;
      if ((el as any).__rendered) return;
      if (!w.turnstile) return;
      (el as any).__rendered = true;
      w.turnstile.render(el, {
        sitekey: turnstileSiteKey,
        callback: (t: string) => setCaptchaToken(String(t || '')),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      });
    };

    if (w.turnstile) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector('script[data-turnstile="1"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', render);
      return () => {
        cancelled = true;
        existing.removeEventListener('load', render);
      };
    }

    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.dataset.turnstile = '1';
    s.addEventListener('load', render);
    document.head.appendChild(s);
    return () => {
      cancelled = true;
      s.removeEventListener('load', render);
    };
  }, [turnstileSiteKey]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        
        await handleRedirectRef.current?.(profile, session.user.email, 'session');
      }
    };
    checkSession();
  }, []);

  const startAdminMfaEnroll = useCallback(async () => {
    const authAny: any = supabase.auth as any;
    if (!authAny?.mfa?.enroll) {
      setError(lang === 'cs' ? '2FA není podporováno.' : '2FA not supported.');
      return;
    }
    setAdminMfaEnroll(true);
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const enroll = async (friendlyName?: string) => {
        const payload: any = { factorType: 'totp' };
        if (friendlyName) payload.friendlyName = friendlyName;
        return await authAny.mfa.enroll(payload);
      };

      let res = await enroll('Pupen.org');
      if (res?.error) {
        const msg = String(res.error?.message || '');
        if (msg.toLowerCase().includes('friendly name') && msg.toLowerCase().includes('already exists')) {
          res = await enroll(`Pupen.org ${Date.now()}`);
        }
      }
      if (res?.error) throw res.error;
      const factorId = String(res?.data?.id || '');
      const rawUri = String(res?.data?.totp?.uri || res?.data?.totp?.qr_code || '');
      if (!factorId || !rawUri) throw new Error('Enroll failed');

      const { data: sessionData } = await supabase.auth.getSession();
      const account = String(sessionData.session?.user?.email || email || '').trim();

      let uri = rawUri;
      try {
        const u = new URL(rawUri);
        if (u.protocol === 'otpauth:') {
          const type = u.hostname || 'totp';
          u.searchParams.set('issuer', 'Pupen.org');
          const label = account ? `Pupen.org:${account}` : 'Pupen.org';
          u.pathname = `/${type}/${encodeURIComponent(label)}`;
          uri = u.toString();
        }
      } catch {
        uri = rawUri;
      }
      setAdminMfaFactorId(factorId);
      const QRCode: any = await import('qrcode');
      const qr = await QRCode.toDataURL(uri, { margin: 1, width: 320 });
      setAdminMfaEnrollQr(qr);
      setAdminMfaEnrollCode('');
      setInfo(lang === 'cs' ? 'Admin účet vyžaduje 2FA. Naskenujte QR a ověřte kód.' : 'Admin accounts require 2FA. Scan QR and verify code.');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('friendly name') && msg.toLowerCase().includes('already exists')) {
        setError(lang === 'cs' ? '2FA už je pro tento účet rozpracované. Pokud nemáte přístup k authenticatoru, požádejte správce o reset 2FA.' : '2FA is already set up for this account. If you cannot access your authenticator, ask an admin to reset 2FA.');
      } else {
        setError(msg || (lang === 'cs' ? 'Chyba' : 'Error'));
      }
      setAdminMfaEnroll(false);
      setAdminMfaEnrollQr('');
      setAdminMfaFactorId('');
      setAdminMfaEnrollCode('');
    } finally {
      setLoading(false);
    }
  }, [email, lang]);

  const verifyAdminMfaEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const authAny: any = supabase.auth as any;
    if (!adminMfaFactorId) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const ch = await authAny?.mfa?.challenge?.({ factorId: adminMfaFactorId });
      const challengeId = String(ch?.data?.id || ch?.data?.challengeId || '');
      if (!challengeId) throw new Error('Challenge failed');
      const res = await authAny?.mfa?.verify?.({ factorId: adminMfaFactorId, challengeId, code: adminMfaEnrollCode });
      if (res?.error) throw res.error;

      setAdminMfaEnroll(false);
      setAdminMfaEnrollQr('');
      setAdminMfaFactorId('');
      setAdminMfaEnrollCode('');

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error('Unauthorized');
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      await handleRedirect(profile, user.email || undefined, 'mfa_enroll');
    } catch (e: any) {
      setError(e?.message || (lang === 'cs' ? 'Chyba' : 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const ensureAdminAal2 = useCallback(async (profile: any, email?: string, method?: string) => {
    const isSuperAdmin = !!profile?.can_manage_admins;
    const hasAdmin = !!(profile?.is_admin || profile?.can_manage_admins);
    if (!hasAdmin || isSuperAdmin) return true;

    const authAny: any = supabase.auth as any;
    const mfaAny: any = authAny?.mfa;
    if (!mfaAny) return true;

    try {
      const aal = await mfaAny.getAuthenticatorAssuranceLevel?.();
      const current = String(aal?.data?.currentLevel || aal?.data?.current_level || '');
      if (current === 'aal2') return true;
    } catch {}

    try {
      const factorsRes = await mfaAny.listFactors?.();
      const totp = factorsRes?.data?.totp || [];
      const all = factorsRes?.data?.all || [];
      const webauthn = factorsRes?.data?.webauthn || (Array.isArray(all) ? all.filter((f: any) => f?.factor_type === 'webauthn') : []);
      const verifiedWeb = Array.isArray(webauthn) ? webauthn.find((f: any) => f?.status === 'verified') : null;
      const verifiedTotp = Array.isArray(totp) ? totp.find((f: any) => f?.status === 'verified') : null;

      if (verifiedWeb?.id && mfaAny?.webauthn?.authenticate) {
        try {
          const r = await mfaAny.webauthn.authenticate({ factorId: String(verifiedWeb.id) });
          if (r?.error) throw r.error;
          return true;
        } catch (e: any) {
          setError(e?.message || (lang === 'cs' ? 'Admin účet vyžaduje 2FA.' : 'Admin accounts require 2FA.'));
          setLoading(false);
          return false;
        }
      }

      if (!verifiedTotp?.id) {
        await startAdminMfaEnroll();
        return false;
      }
      const factorId = String(verifiedTotp.id);
      const ch = await mfaAny.challenge?.({ factorId });
      const challengeId = String(ch?.data?.id || ch?.data?.challengeId || '');
      if (!challengeId) throw new Error('Challenge failed');
      setMfa({ factorId, challengeId });
      setMfaCode('');
      setError(lang === 'cs' ? 'Admin účet vyžaduje 2FA.' : 'Admin accounts require 2FA.');
      await logSecurity('LOGIN_NO_ACCESS', { method: method || 'session', reason: 'admin_requires_2fa' });
      setLoading(false);
      return false;
    } catch {
      await startAdminMfaEnroll();
      return false;
    }
  }, [lang, logSecurity, startAdminMfaEnroll]);

  const handleRedirect = useCallback(async (profile: any, email?: string, method?: string) => {
    const isSuperAdmin = !!profile?.can_manage_admins;
    const hasAdmin = !!(profile?.is_admin || profile?.can_manage_admins);
    const hasMember =
      !!(profile?.is_member || profile?.is_admin || profile?.can_manage_admins || profile?.can_view_member_portal || profile?.can_edit_member_portal) ||
      isSuperAdmin;

    if (hasAdmin) {
      const ok = await ensureAdminAal2(profile, email, method);
      if (!ok) return;
    }

    if (hasAdmin && hasMember) {
      setShowRoleSelection(true);
      await logSecurity('LOGIN_SUCCESS', { method: method || 'session', outcome: 'multi' });
    } else if (hasAdmin) {
      await logSecurity('LOGIN_SUCCESS', { method: method || 'session', outcome: 'admin' });
      router.replace(`/${lang}/admin/dashboard`);
    } else if (hasMember) {
      await logSecurity('LOGIN_SUCCESS', { method: method || 'session', outcome: 'member' });
      router.replace(`/${lang}/clen`);
    } else {
      setError((dict?.auth?.login?.noAccess as string) || (lang === 'cs' ? 'Váš účet nemá přístup do chráněných sekcí.' : 'Your account has no access to protected sections.'));
      await logSecurity('LOGIN_NO_ACCESS', { method: method || 'session' });
      supabase.auth.signOut();
    }
  }, [dict?.auth?.login?.noAccess, ensureAdminAal2, lang, logSecurity, router]);
  handleRedirectRef.current = handleRedirect;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const guard = await fetch('/api/auth/login-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(turnstileSiteKey ? { token: captchaToken } : {}),
      });
      if (!guard.ok) {
        const j = await guard.json().catch(() => ({}));
        if (guard.status === 400) {
          setError(lang === 'cs' ? 'Ověřte, že nejste robot.' : 'Please verify you are not a robot.');
          setLoading(false);
          return;
        }
        const retryAfterMs = Number(j?.retryAfterMs || 0);
        const sec = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 60;
        setError(lang === 'cs' ? `Příliš mnoho pokusů. Zkuste to za ${sec}s.` : `Too many attempts. Try again in ${sec}s.`);
        setLoading(false);
        return;
      }
    } catch {}

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError((dict?.auth?.login?.loginError as string) || (lang === 'cs' ? 'Chyba přihlášení. Zkontrolujte údaje.' : 'Login error. Please check your credentials.'));
      setLoading(false);
    } else if ((data as any)?.mfa && !(data as any)?.session) {
      try {
        const anyData: any = data as any;
        const factors = anyData?.mfa?.factors || anyData?.mfa?.availableFactors || [];
        const factorId = String(anyData?.mfa?.factorId || factors?.[0]?.id || '');
        if (!factorId) throw new Error((dict?.auth?.login?.mfaRequired as string) || (lang === 'cs' ? 'Vyžadováno 2FA.' : '2FA required.'));
        const authAny: any = supabase.auth as any;
        const ch = await authAny?.mfa?.challenge?.({ factorId });
        const challengeId = String(ch?.data?.id || ch?.data?.challengeId || '');
        if (!challengeId) throw new Error((dict?.auth?.login?.mfaRequired as string) || (lang === 'cs' ? 'Vyžadováno 2FA.' : '2FA required.'));
        setMfa({ factorId, challengeId });
        setLoading(false);
      } catch {
        setError((dict?.auth?.login?.mfaRequired as string) || (lang === 'cs' ? 'Vyžadováno 2FA.' : '2FA required.'));
        setLoading(false);
      }
    } else if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      
      await handleRedirect(profile, data.user.email, 'password');
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!mfa) throw new Error('Missing MFA');
      const authAny: any = supabase.auth as any;
      const res = await authAny?.mfa?.verify?.({ factorId: mfa.factorId, challengeId: mfa.challengeId, code: mfaCode });
      if (res?.error) throw res.error;
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error('Unauthorized');
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setMfa(null);
      setMfaCode('');
      await handleRedirect(profile, user.email || undefined, 'mfa');
    } catch (e: any) {
      setError(e?.message || (lang === 'cs' ? 'Chyba' : 'Error'));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!googleAuthEnabled) return;
    setError('');
    setLoading(true);
    try {
      try {
        const guard = await fetch('/api/auth/login-guard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(turnstileSiteKey ? { token: captchaToken } : {}),
        });
        if (!guard.ok) {
          if (guard.status === 400) {
            setError(lang === 'cs' ? 'Ověřte, že nejste robot.' : 'Please verify you are not a robot.');
            setLoading(false);
            return;
          }
          const j = await guard.json().catch(() => ({}));
          const retryAfterMs = Number(j?.retryAfterMs || 0);
          const sec = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 60;
          setError(lang === 'cs' ? `Příliš mnoho pokusů. Zkuste to za ${sec}s.` : `Too many attempts. Try again in ${sec}s.`);
          setLoading(false);
          return;
        }
      } catch {}

      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/${lang}/login` },
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || (lang === 'cs' ? 'Chyba' : 'Error'));
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      try {
        const guard = await fetch('/api/auth/login-guard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(turnstileSiteKey ? { token: captchaToken } : {}),
        });
        if (!guard.ok) {
          if (guard.status === 400) {
            setError(lang === 'cs' ? 'Ověřte, že nejste robot.' : 'Please verify you are not a robot.');
            setLoading(false);
            return;
          }
          const j = await guard.json().catch(() => ({}));
          const retryAfterMs = Number(j?.retryAfterMs || 0);
          const sec = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 60;
          setError(lang === 'cs' ? `Příliš mnoho pokusů. Zkuste to za ${sec}s.` : `Too many attempts. Try again in ${sec}s.`);
          setLoading(false);
          return;
        }
      } catch {}

      const emailValue = String(email || '').trim();
      if (!emailValue) {
        setError(lang === 'cs' ? 'Zadejte e-mail.' : 'Enter your email.');
        setLoading(false);
        return;
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: emailValue, password });
      if (loginError) {
        setError((dict?.auth?.login?.loginError as string) || (lang === 'cs' ? 'Chyba přihlášení. Zkontrolujte údaje.' : 'Login error. Please check your credentials.'));
        setLoading(false);
        return;
      }

      if ((data as any)?.mfa && !(data as any)?.session) {
        const anyData: any = data as any;
        const factors = anyData?.mfa?.factors || anyData?.mfa?.availableFactors || [];
        const web = Array.isArray(factors) ? factors.find((f: any) => f?.factor_type === 'webauthn' || f?.type === 'webauthn') : null;
        const factorId = String(anyData?.mfa?.factorId || web?.id || factors?.[0]?.id || '');
        const authAny: any = supabase.auth as any;
        if (web && authAny?.mfa?.webauthn?.authenticate) {
          const r = await authAny.mfa.webauthn.authenticate({ factorId });
          if (r?.error) throw r.error;
          const { data: sessionData } = await supabase.auth.getSession();
          const user = sessionData.session?.user;
          if (!user) throw new Error('Unauthorized');
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
          await handleRedirect(profile, user.email || undefined, 'passkey');
          return;
        }

        if (!factorId) throw new Error((dict?.auth?.login?.mfaRequired as string) || (lang === 'cs' ? 'Vyžadováno 2FA.' : '2FA required.'));
        const ch = await authAny?.mfa?.challenge?.({ factorId });
        const challengeId = String(ch?.data?.id || ch?.data?.challengeId || '');
        if (!challengeId) throw new Error((dict?.auth?.login?.mfaRequired as string) || (lang === 'cs' ? 'Vyžadováno 2FA.' : '2FA required.'));
        setMfa({ factorId, challengeId });
        setLoading(false);
        return;
      }

      if ((data as any)?.user) {
        const u: any = (data as any).user;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
        await handleRedirect(profile, u.email, 'passkey');
        return;
      }
    } catch (e: any) {
      setError(e?.message || (lang === 'cs' ? 'Chyba' : 'Error'));
      setLoading(false);
    }
  };

  if (showRoleSelection) {
    const t = dict?.auth?.login || {};
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-lg text-center border border-stone-100 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">
            {t.rolePickTitle || (lang === 'cs' ? 'Vyberte sekci' : 'Select Section')}
          </h1>
          <p className="text-stone-500 mb-10 font-medium">
            {t.rolePickSubtitle || (lang === 'cs' ? 'Máte přístup do více částí portálu Pupen.' : 'You have access to multiple parts of the Pupen portal.')}
          </p>
          
          <div className="grid gap-4">
            <button
              onClick={async () => {
                await logSecurity('LOGIN_SUCCESS', { method: 'session', outcome: 'admin' });
                router.push(`/${lang}/admin/dashboard`);
              }}
              className="group flex items-center justify-between p-6 bg-stone-900 text-white rounded-[2rem] hover:bg-green-600 transition-all duration-300 shadow-xl shadow-stone-900/20"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl">
                  <Lock size={24} />
                </div>
                <div className="text-left">
                  <p className="font-black uppercase tracking-widest text-[10px] opacity-60">{t.roleAdminBadge || 'Control Panel'}</p>
                  <p className="text-xl font-bold">{t.roleAdminTitle || 'Pupen Control'}</p>
                </div>
              </div>
              <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>

            <button
              onClick={async () => {
                await logSecurity('LOGIN_SUCCESS', { method: 'session', outcome: 'member' });
                router.push(`/${lang}/clen`);
              }}
              className="group flex items-center justify-between p-6 bg-white text-stone-900 rounded-[2rem] border-2 border-stone-100 hover:border-green-500 hover:text-green-600 transition-all duration-300 shadow-lg shadow-stone-200/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-stone-50 rounded-xl group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                  <ShieldCheck size={24} />
                </div>
                <div className="text-left">
                  <p className="font-black uppercase tracking-widest text-[10px] text-stone-400">{t.roleMemberBadge || 'Member Section'}</p>
                  <p className="text-xl font-bold">{t.roleMemberTitle || (lang === 'cs' ? 'Členský portál' : 'Member Portal')}</p>
                </div>
              </div>
              <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>
          </div>

          <button 
            onClick={() => supabase.auth.signOut().then(() => setShowRoleSelection(false))}
            className="mt-10 text-stone-400 font-bold hover:text-red-500 transition text-sm"
          >
            {t.logout || (lang === 'cs' ? 'Odhlásit se' : 'Log out')}
          </button>
        </div>
      </div>
    );
  }

  const t = dict?.auth?.login || {};
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-stone-100">
        <div className="flex justify-center mb-8">
          <div className="bg-green-50 p-5 rounded-full shadow-inner">
            <Leaf className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">
          {t.title || (lang === 'cs' ? 'Vítejte zpět' : 'Welcome back')}
        </h1>
        <p className="text-stone-500 mb-10 font-medium">
          {t.subtitle || (lang === 'cs' ? 'Přihlášení do ekosystému Pupen' : 'Log in to the Pupen ecosystem')}
        </p>
        
        <form onSubmit={adminMfaEnroll ? verifyAdminMfaEnroll : mfa ? handleMfaVerify : handleLogin} className="space-y-4 text-left">
          {adminMfaEnroll ? (
            <div className="space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                {lang === 'cs' ? 'Nastavení 2FA pro admin účet' : 'Set up 2FA for admin account'}
              </div>
              {adminMfaEnrollQr ? (
                <div className="flex justify-center">
                  <Image src={adminMfaEnrollQr} alt="2FA QR" width={192} height={192} className="w-48 h-48 rounded-2xl border border-stone-200" unoptimized />
                </div>
              ) : null}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                  {t.mfaCodeLabel || (lang === 'cs' ? '2FA kód' : '2FA code')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={adminMfaEnrollCode}
                  onChange={(e) => setAdminMfaEnrollCode(e.target.value)}
                  aria-invalid={error ? 'true' : 'false'}
                  className="w-full bg-stone-50 border-none rounded-2xl px-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="123456"
                />
                <div className="text-[9px] text-stone-400 italic px-1">
                  {t.mfaHint || (lang === 'cs' ? 'Zadejte kód z autentizační aplikace.' : 'Enter code from your authenticator app.')}
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  await supabase.auth.signOut();
                  setAdminMfaEnroll(false);
                  setAdminMfaEnrollQr('');
                  setAdminMfaFactorId('');
                  setAdminMfaEnrollCode('');
                }}
                className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
              >
                {lang === 'cs' ? 'Zrušit' : 'Cancel'}
              </button>
            </div>
          ) : mfa ? (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                {t.mfaCodeLabel || (lang === 'cs' ? '2FA kód' : '2FA code')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                aria-invalid={error ? 'true' : 'false'}
                className="w-full bg-stone-50 border-none rounded-2xl px-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="123456"
              />
              <div className="text-[9px] text-stone-400 italic px-1">
                {t.mfaHint || (lang === 'cs' ? 'Zadejte kód z autentizační aplikace.' : 'Enter code from your authenticator app.')}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                  {t.emailLabel || (lang === 'cs' ? 'E-mail' : 'Email')}
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
                    placeholder={t.emailPlaceholder || 'vas@email.cz'}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                  {t.passwordLabel || (lang === 'cs' ? 'Heslo' : 'Password')}
                </label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    required
                    ariaInvalid={!!error}
                    placeholder={t.passwordPlaceholder || '••••••••'}
                    inputClassName="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-12 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    buttonClassName="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-700 transition"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end">
                <Link href={`/${lang}/forgot`} className="text-stone-400 text-xs font-bold hover:text-green-600 transition">
                  {t.forgotPassword || (lang === 'en' ? 'Forgot password?' : 'Zapomenuté heslo?')}
                </Link>
              </div>
            </>
          )}

          {error && (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 animate-shake">
              <p className="text-red-600 text-xs font-bold text-center">
                {error}
              </p>
            </div>
          )}
          {info && (
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
              <p className="text-green-700 text-xs font-bold text-center">{info}</p>
            </div>
          )}

          {!mfa && turnstileSiteKey ? (
            <div className="pt-1">
              <div id="turnstile-login" className="flex justify-center" />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 transition shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
          >
            {loading ? <InlinePulse className="bg-white/80" size={14} /> : <Lock size={18} />}
            {mfa
              ? loading
                ? (t.mfaVerifying || (lang === 'cs' ? 'Ověřuji...' : 'Verifying...'))
                : (t.mfaVerify || (lang === 'cs' ? 'Ověřit' : 'Verify'))
              : loading
                ? (t.submitting || (lang === 'cs' ? 'Přihlašuji...' : 'Logging in...'))
                : (t.submit || (lang === 'cs' ? 'Přihlásit se' : 'Log in'))}
          </button>

          {!mfa && (
            <div className="space-y-3">
              {googleAuthEnabled ? (
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {t.google || (lang === 'cs' ? 'Pokračovat s Google' : 'Continue with Google')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handlePasskey}
                disabled={loading}
                className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
              >
                {lang === 'cs' ? 'Přihlásit se passkey' : 'Sign in with passkey'}
              </button>
            </div>
          )}
        </form>

        <div className="mt-10 pt-8 border-t border-stone-50">
          <Link href={`/${lang}/prihlaska`} className="text-stone-400 text-sm font-bold hover:text-green-600 transition">
            {t.applyLink || (lang === 'cs' ? 'Ještě nemáte účet? Podat přihlášku' : 'No account yet? Apply here')}
          </Link>
        </div>
      </div>
    </div>
  );
}
