'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Lock, ShieldCheck, FileText, Download, Users, 
  ArrowLeft, FileCheck, BookOpen, Clock, 
  Mail, X, Calendar, Settings, LayoutDashboard, Save, KeyRound
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { getDictionary } from '@/lib/get-dictionary';
import dynamic from 'next/dynamic';
import MemberSidebar from './components/MemberSidebar';
import Skeleton, { SkeletonTabContent } from '../components/Skeleton';
import InlinePulse from '@/app/components/InlinePulse';
import OnboardingCard from './components/OnboardingCard';
import MemberPanel from './components/ui/MemberPanel';
import PasswordField from '@/app/components/PasswordField';

const MemberCard = dynamic<any>(() => import('./components/MemberCard'), { loading: () => <SkeletonTabContent /> });
const MyEventsTab = dynamic<any>(() => import('./components/MyEventsTab'), { loading: () => <SkeletonTabContent /> });
const AvatarUploader = dynamic<any>(() => import('./components/AvatarUploader'), { loading: () => <Skeleton className="h-16 w-16 rounded-full" /> });
const NotificationsTab = dynamic<any>(() => import('./components/NotificationsTab'), { loading: () => <SkeletonTabContent /> });
const MemberMessagesTab = dynamic<any>(() => import('./components/MemberMessagesTab'), { loading: () => <SkeletonTabContent /> });
const ReportModal = dynamic<any>(() => import('./components/ReportModal'), { loading: () => null });
const GuidelinesTab = dynamic<any>(() => import('./components/GuidelinesTab'), { loading: () => <SkeletonTabContent /> });
const ProjectsTab = dynamic<any>(() => import('./components/ProjectsTab'), { loading: () => <SkeletonTabContent /> });
const MemberPollsTab = dynamic<any>(() => import('./components/MemberPollsTab'), { loading: () => <SkeletonTabContent /> });
const MemberBoardTab = dynamic<any>(() => import('./components/MemberBoardTab'), { loading: () => <SkeletonTabContent /> });
const MemberGovernanceTab = dynamic<any>(() => import('./components/MemberGovernanceTab'), { loading: () => <SkeletonTabContent /> });

export default function ClenskaSekcePage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const router = useRouter();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [memberPortalCfg, setMemberPortalCfg] = useState<{
    hiddenTabs: string[];
    showOnboarding: boolean;
    defaultTab?: string;
    supportEmail?: string;
    supportPhone?: string;
    quickLinks?: Array<{ label_cs?: string; label_en?: string; url?: string }>;
  }>({
    hiddenTabs: [],
    showOnboarding: true,
  });
  const [didInitTab, setDidInitTab] = useState(false);
  const [memberDefaultTab, setMemberDefaultTab] = useState('dashboard');
  const [uiPrefsSaving, setUiPrefsSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState<null | { type: 'user' | 'content'; id: string; label: string }>(null);
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [showBlocked, setShowBlocked] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dict, setDict] = useState<any>(null);
  const [emailPrefs, setEmailPrefs] = useState<any>({
    digestWeekly: true,
    categories: { events: true, community: true, finance: true, news: true },
  });
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('pupen_blocklist_v1');
      const parsed = raw ? JSON.parse(raw) : {};
      setBlocked(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setBlocked({});
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch('/api/site-config');
      const json = await res.json().catch(() => ({}));
      const mp = json?.config?.member_portal && typeof json.config.member_portal === 'object' ? json.config.member_portal : {};
      const hiddenTabs = Array.isArray(mp.hidden_tabs) ? mp.hidden_tabs.map((x: any) => String(x)) : [];
      const showOnboarding = mp.show_onboarding !== false;
      const defaultTab = typeof mp.default_tab === 'string' ? mp.default_tab : undefined;
      const supportEmail = typeof mp.support_email === 'string' ? mp.support_email : undefined;
      const supportPhone = typeof mp.support_phone === 'string' ? mp.support_phone : undefined;
      const quickLinks = Array.isArray(mp.quick_links) ? mp.quick_links : [];
      if (mounted) setMemberPortalCfg({ hiddenTabs, showOnboarding, defaultTab, supportEmail, supportPhone, quickLinks });
    })().catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const hidden = new Set(memberPortalCfg.hiddenTabs.map(String));
    if (!hidden.size) return;
    if (!hidden.has(activeTab)) return;
    const preferred = memberPortalCfg.defaultTab && !hidden.has(memberPortalCfg.defaultTab) ? memberPortalCfg.defaultTab : 'dashboard';
    setActiveTab(preferred);
  }, [memberPortalCfg.hiddenTabs, memberPortalCfg.defaultTab]);

  const toggleBlocked = (email: string) => {
    const key = String(email || '').toLowerCase();
    const next = { ...blocked, [key]: !blocked[key] };
    if (!next[key]) delete next[key];
    setBlocked(next);
    try {
      window.localStorage.setItem('pupen_blocklist_v1', JSON.stringify(next));
    } catch {}
  };
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editProfile, setEditProfile] = useState({ first_name: '', last_name: '' });
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string>('');
  const [mfaEnrollUri, setMfaEnrollUri] = useState<string>('');
  const [mfaEnrollQr, setMfaEnrollQr] = useState<string>('');
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const logSecurityEvent = async (event: string, details?: any) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch('/api/auth/security-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event, details: details && typeof details === 'object' ? details : {} }),
      });
    } catch {}
  };

  useEffect(() => {
    async function init() {
      // Load dictionary
      const d = await getDictionary(lang);
      setDict(d);

      // Check access
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace(`/${lang}/login`);
        return;
      }
      
      setUser(session.user);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      
      const isSuperAdmin = session.user.email === 'cepelak@pupen.org';
      if (!prof?.is_member && !isSuperAdmin && !prof?.is_admin) {
        router.replace(`/${lang}/login`);
        return;
      }
      
      const userProf = prof || (isSuperAdmin ? { first_name: 'Super', last_name: 'Admin', is_admin: true, is_member: true } : null);
      setProfile(userProf);
      const prefTab = (userProf as any)?.ui_prefs?.member?.defaultTab ? String((userProf as any).ui_prefs.member.defaultTab) : '';
      if (prefTab) setMemberDefaultTab(prefTab);
      if (prefTab && !didInitTab) {
        setActiveTab(prefTab);
        setDidInitTab(true);
      }
      setEditProfile({ 
        first_name: userProf?.first_name || '', 
        last_name: userProf?.last_name || '' 
      });
      setLoading(false);
    }
    init();
  }, [lang, router]);

  useEffect(() => {
    if (activeTab !== 'settings' || !user) return;
    (async () => {
      setPrefsLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/preferences/email', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (json?.prefs) setEmailPrefs(json.prefs);
      } finally {
        setPrefsLoading(false);
      }
    })();
  }, [activeTab, user]);

  const saveEmailPrefs = async () => {
    setPrefsSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');
      const res = await fetch('/api/preferences/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prefs: emailPrefs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      showToast(lang === 'en' ? 'Saved' : 'Uloženo', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setPrefsSaving(false);
    }
  };

  const saveMemberPrefs = async () => {
    if (!user) return;
    setUiPrefsSaving(true);
    try {
      const next = {
        ...(profile?.ui_prefs && typeof profile.ui_prefs === 'object' ? profile.ui_prefs : {}),
        member: {
          ...((profile?.ui_prefs?.member && typeof profile.ui_prefs.member === 'object') ? profile.ui_prefs.member : {}),
          defaultTab: memberDefaultTab,
        },
      };
      const { error } = await supabase.from('profiles').update({ ui_prefs: next }).eq('id', user.id);
      if (error) throw error;
      setProfile((p: any) => ({ ...(p || {}), ui_prefs: next }));
      showToast(lang === 'en' ? 'Saved' : 'Uloženo', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setUiPrefsSaving(false);
    }
  };

  const downloadGdprExport = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const res = await fetch('/api/gdpr/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Request failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pupen_gdpr_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast(lang === 'en' ? 'Export downloaded' : 'Export stažen', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  const requestGdprDelete = async () => {
    const ok = confirm(
      lang === 'en'
        ? 'Send a data deletion request to admins? This does not delete data immediately.'
        : 'Odeslat žádost o smazání osobních údajů administrátorům? Data se nesmažou okamžitě.',
    );
    if (!ok) return;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const res = await fetch('/api/gdpr/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Žádost o smazání dat z členského portálu' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      showToast(lang === 'en' ? 'Request sent' : 'Žádost odeslána', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editProfile.first_name,
          last_name: editProfile.last_name
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setProfile({ ...profile, ...editProfile });
      showToast(dict.member.profileUpdated, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pw1 || pw1.length < 8) {
      showToast(lang === 'en' ? 'Password must be at least 8 characters.' : 'Heslo musí mít alespoň 8 znaků.', 'error');
      return;
    }
    if (pw1 !== pw2) {
      showToast(lang === 'en' ? 'Passwords do not match.' : 'Hesla se neshodují.', 'error');
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPw1('');
      setPw2('');
      showToast(lang === 'en' ? 'Password updated.' : 'Heslo změněno.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  const refreshMfa = async () => {
    const authAny: any = supabase.auth as any;
    if (!authAny?.mfa?.listFactors) return;
    setMfaLoading(true);
    try {
      const res = await authAny.mfa.listFactors();
      if (res?.error) throw res.error;
      const factors = res?.data?.totp || res?.data?.all || [];
      const factor = Array.isArray(factors) ? factors.find((f: any) => f?.status === 'verified') || factors[0] : null;
      const enabled = !!factor && (factor.status === 'verified' || factor.status === 'unverified');
      setMfaEnabled(enabled);
      setMfaFactorId(String(factor?.id || ''));
    } catch {
      setMfaEnabled(false);
      setMfaFactorId('');
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    refreshMfa();
  }, []);

  const startMfaEnroll = async () => {
    const authAny: any = supabase.auth as any;
    if (!authAny?.mfa?.enroll) {
      showToast(lang === 'en' ? '2FA not supported.' : '2FA není podporováno.', 'error');
      await logSecurityEvent('MFA_ENROLL_START', { supported: false });
      return;
    }
    setMfaLoading(true);
    try {
      await logSecurityEvent('MFA_ENROLL_START', { supported: true });
      const res = await authAny.mfa.enroll({ factorType: 'totp' });
      if (res?.error) throw res.error;
      const factorId = String(res?.data?.id || '');
      const uri = String(res?.data?.totp?.uri || res?.data?.totp?.qr_code || '');
      if (!factorId || !uri) throw new Error('Enroll failed');
      setMfaFactorId(factorId);
      setMfaEnrollUri(uri);
      const QRCode: any = await import('qrcode');
      const qr = await QRCode.toDataURL(uri, { margin: 1, width: 320 });
      setMfaEnrollQr(qr);
      setMfaVerifyCode('');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyMfaEnroll = async () => {
    const authAny: any = supabase.auth as any;
    if (!mfaFactorId) return;
    setMfaLoading(true);
    try {
      const ch = await authAny?.mfa?.challenge?.({ factorId: mfaFactorId });
      const challengeId = String(ch?.data?.id || ch?.data?.challengeId || '');
      if (!challengeId) throw new Error('Challenge failed');
      const res = await authAny?.mfa?.verify?.({ factorId: mfaFactorId, challengeId, code: mfaVerifyCode });
      if (res?.error) throw res.error;
      setMfaEnrollUri('');
      setMfaEnrollQr('');
      setMfaVerifyCode('');
      await refreshMfa();
      showToast(lang === 'en' ? '2FA enabled.' : '2FA zapnuto.', 'success');
      await logSecurityEvent('MFA_ENABLED', {});
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    const authAny: any = supabase.auth as any;
    if (!authAny?.mfa?.unenroll || !mfaFactorId) return;
    setMfaLoading(true);
    try {
      const res = await authAny.mfa.unenroll({ factorId: mfaFactorId });
      if (res?.error) throw res.error;
      setMfaEnrollUri('');
      setMfaEnrollQr('');
      setMfaVerifyCode('');
      await refreshMfa();
      showToast(lang === 'en' ? '2FA disabled.' : '2FA vypnuto.', 'success');
      await logSecurityEvent('MFA_DISABLED', {});
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setMfaLoading(false);
    }
  };

  const linkGoogle = async () => {
    setGoogleBusy(true);
    try {
      const origin = window.location.origin;
      const authAny: any = supabase.auth as any;
      if (typeof authAny?.linkIdentity === 'function') {
        await logSecurityEvent('GOOGLE_LINK_START', {});
        const res = await authAny.linkIdentity({ provider: 'google', options: { redirectTo: `${origin}/${lang}/clen` } });
        if (res?.error) throw res.error;
      } else {
        await logSecurityEvent('GOOGLE_LINK_UNSUPPORTED', {});
        showToast(ms.googleLinkUnsupported || (lang === 'en' ? 'Google linking is not available in this installation.' : 'Propojení Google není v této instalaci dostupné.'), 'error');
        setGoogleBusy(false);
        return;
      }
    } catch (e: any) {
      await logSecurityEvent('GOOGLE_LINK_ERROR', { message: String(e?.message || ''), code: e?.code ? String(e.code) : undefined });
      showToast(e?.message || 'Chyba', 'error');
      setGoogleBusy(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace(`/${lang}/login`);
  };

  // Načtení dat (Queries)
  const { data: internalDocs = [] } = useQuery({
    queryKey: ['internal_docs'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('is_member_only', true)
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    }
  });

  const { data: myApplication } = useQuery({
    queryKey: ['member_my_application', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const res = await supabase
        .from('applications')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1);
      if (res.error) throw res.error;
      return res.data?.[0] || null;
    },
  });

  const { data: memberEvents = [] } = useQuery({
    queryKey: ['member_events'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('is_member_only', true)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(100);
      return data || [];
    }
  });

  const { data: directory = [] } = useQuery({
    queryKey: ['member_directory'],
    enabled: !!user && !!profile?.is_member && activeTab === 'directory',
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, member_since')
        .eq('is_member', true)
        .order('last_name', { ascending: true })
        .limit(500);
      return data || [];
    }
  });

  const { data: myBlogs = [] } = useQuery({
    queryKey: ['my_blogs', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const email = String(user.email || '').trim();
      const { data } = await supabase
        .from('posts')
        .select('*')
        .or(`author_email.eq.${email},content.ilike.%${email}%`)
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    }
  });

  if (loading || !dict) return (
    <div className="min-h-screen bg-stone-50 lg:pl-72">
      {/* Sidebar Skeleton */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 w-72 bg-white border-r border-stone-100 p-8 space-y-10">
        <Skeleton className="h-10 w-32 rounded-xl" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-2xl" />
          ))}
        </div>
      </div>
      
      <main className="p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-6xl mx-auto">
          <header className="mb-12 space-y-4">
            <Skeleton className="h-12 w-1/2 rounded-2xl" />
            <Skeleton className="h-4 w-1/4 rounded-lg" />
          </header>
          <SkeletonTabContent />
        </div>
      </main>
    </div>
  );

  if (!user) return null;

  const ms = dict?.memberSettings || {};
  const safeHref = (raw: string) => {
    const v = String(raw || '').trim();
    if (!v) return null;
    if (v.startsWith('/')) return v;
    if (v.startsWith('mailto:') || v.startsWith('tel:')) return v;
    try {
      const u = new URL(v);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
      return null;
    } catch {
      return null;
    }
  };
  const hasAccessToMemberPortal = profile?.is_member || user.email === 'cepelak@pupen.org' || profile?.is_admin;

  if (!hasAccessToMemberPortal) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-xl text-center border border-stone-100">
          <div className="w-20 h-20 bg-stone-50 text-stone-300 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Lock size={40} />
          </div>
          <h1 className="text-3xl font-black text-stone-900 mb-4 tracking-tight">{dict.member.limitedAccessTitle}</h1>
          <p className="text-stone-500 mb-8 font-medium">{dict.member.limitedAccessDesc}</p>
          <div className="space-y-3">
            <button onClick={handleLogout} className="block w-full bg-stone-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-stone-800 transition shadow-lg">
              {dict.member.logoutBtn}
            </button>
            <Link href={`/${lang}`} className="block w-full text-stone-400 font-bold hover:text-stone-600 transition text-sm py-2">
              {dict.member.backHome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 lg:pl-72">
      <ReportModal
        open={!!reportOpen}
        onClose={() => setReportOpen(null)}
        lang={lang}
        targetType={reportOpen?.type || 'user'}
        targetId={reportOpen?.id || ''}
        targetLabel={reportOpen?.label || ''}
        sourceUrl={typeof window !== 'undefined' ? window.location.href : null}
      />
      <MemberSidebar 
        lang={lang}
        dict={dict}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userProfile={profile}
        onLogout={handleLogout}
        hiddenTabs={memberPortalCfg.hiddenTabs}
      />

      <main className="p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-6xl mx-auto">
          {/* HEADER */}
          <header className="mb-12">
            <h1 className="text-3xl lg:text-5xl font-black text-stone-900 tracking-tight">
              {dict.member.welcome}, <span className="text-green-600">{profile?.first_name || user?.email?.split('@')[0]}</span>!
            </h1>
            <p className="text-stone-500 font-medium mt-2 flex items-center gap-2">
              {ms.statusLabel || (lang === 'en' ? 'Status' : 'Status')}:{' '}
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                {profile?.is_member ? dict.member.activeStatus : (dict.member.pendingStatus || 'Čeká na schválení')}
              </span>
              {profile?.member_since && <span className="text-stone-300">|</span>}
              {profile?.member_since && <span>{dict.member.memberSince} {new Date(profile.member_since).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US')}</span>}
            </p>
          </header>

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="grid lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                {/* MOJE PŘIHLÁŠKA */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                  <h2 className="text-xl font-black mb-6 flex items-center gap-3"><FileText className="text-green-600" /> {dict.member.myApplication}</h2>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-stone-50 rounded-[2rem]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm">
                        <FileCheck size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-stone-900">
                          {myApplication
                            ? (myApplication.status === 'approved'
                                ? (dict.member.appApproved || 'Přihláška schválena')
                                : myApplication.status === 'rejected'
                                  ? (dict.member.appRejected || 'Přihláška zamítnuta')
                                  : (dict.member.appPending || 'Přihláška evidována'))
                            : (dict.member.appMissing || 'Přihláška nenalezena')}
                        </p>
                        <p className="text-xs text-stone-400 font-medium uppercase tracking-widest">
                          {myApplication?.status === 'approved'
                            ? (dict.member.officialMember || 'Oficiální člen')
                            : myApplication?.status === 'rejected'
                              ? (dict.member.notMember || 'Není člen')
                              : (dict.member.awaitingReview || 'Čeká na kontrolu')}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/${lang}/clen/prihlaska`}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-stone-600 rounded-xl font-bold text-xs hover:bg-stone-100 transition shadow-sm border border-stone-100"
                    >
                      <Download size={14} /> {dict.member.downloadApp || (lang === 'en' ? 'Open / Print' : 'Otevřít / Tisk')}
                    </Link>
                  </div>
                </div>

                {/* ČLENSKÉ AKCE PREVIEW */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black flex items-center gap-3"><Calendar className="text-amber-600" /> {dict.member.memberEvents}</h2>
                    <button onClick={() => setActiveTab('events')} className="text-xs font-bold text-stone-400 hover:text-amber-600 transition">{ms.showAll || (lang === 'en' ? 'Show all' : 'Zobrazit vše')}</button>
                  </div>
                  {memberEvents.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {memberEvents.slice(0, 4).map((event: any) => (
                        <Link key={event.id} href={`/${lang}/akce`} className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-transparent hover:border-amber-200 hover:bg-amber-50/30 transition group">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm group-hover:bg-amber-600 group-hover:text-white transition-all shrink-0">
                            <Clock size={20} />
                          </div>
                          <div className="flex-grow min-w-0">
                            <h3 className="font-bold text-stone-900 text-sm truncate">{lang === 'en' && event.title_en ? event.title_en : event.title}</h3>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">{new Date(event.date).toLocaleDateString()} • {event.location}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-stone-400 font-medium italic">{dict.member.noEvents}</p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                {/* DOKUMENTY PREVIEW */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-3"><FileText className="text-stone-900" /> {dict.member.internalDocs}</h3>
                  <div className="space-y-3">
                    {internalDocs.length > 0 ? internalDocs.slice(0, 5).map((doc: any) => (
                      <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-4 bg-stone-50 rounded-2xl hover:bg-green-50 transition group text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-stone-400 group-hover:text-green-600 shadow-sm transition">
                            <FileText size={18} />
                          </div>
                          <span className="text-sm font-bold text-stone-700 truncate max-w-[120px]">{lang === 'en' && doc.title_en ? doc.title_en : doc.title}</span>
                        </div>
                        <Download size={16} className="text-stone-300 group-hover:text-green-600 transition" />
                      </a>
                    )) : (
                      <p className="text-xs text-stone-400 italic text-center py-4">{dict.member.noDocs}</p>
                    )}
                  </div>
                  {internalDocs.length > 5 && (
                    <button onClick={() => setActiveTab('documents')} className="w-full mt-4 text-center text-xs font-bold text-stone-400 hover:text-green-600 transition">{ms.allDocuments || (lang === 'en' ? 'All documents' : 'Všechny dokumenty')}</button>
                  )}
                </div>

                {memberPortalCfg.showOnboarding && <OnboardingCard lang={lang} userId={user.id} profile={profile} onNavigate={setActiveTab} />}

                {Array.isArray(memberPortalCfg.quickLinks) && memberPortalCfg.quickLinks.length > 0 && (
                  <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                    <h3 className="text-xl font-black mb-6">{dict.memberPortalConfig?.quickLinksTitle || (lang === 'en' ? 'Quick links' : 'Rychlé odkazy')}</h3>
                    <div className="space-y-3">
                      {memberPortalCfg.quickLinks
                        .map((x) => ({
                          label: String((lang === 'en' ? x?.label_en : x?.label_cs) || x?.label_cs || x?.label_en || '').trim(),
                          href: safeHref(String(x?.url || '')),
                        }))
                        .filter((x) => x.label && x.href)
                        .map((x) => (
                          <a
                            key={`${x.href}-${x.label}`}
                            href={String(x.href)}
                            target={String(x.href).startsWith('/') ? undefined : '_blank'}
                            rel={String(x.href).startsWith('/') ? undefined : 'noopener noreferrer'}
                            className="w-full flex items-center justify-between p-4 bg-stone-50 rounded-2xl hover:bg-green-50 transition group text-left border border-transparent hover:border-green-100"
                          >
                            <span className="text-sm font-bold text-stone-700">{x.label}</span>
                            <ArrowLeft size={16} className="text-stone-300 group-hover:text-green-600 transition rotate-180 shrink-0" />
                          </a>
                        ))}
                    </div>
                  </div>
                )}

                {/* HELP CARD */}
                <div className="bg-green-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-green-600/20">
                  <h3 className="text-xl font-black mb-4 tracking-tight">{dict.member.needHelp}</h3>
                  <p className="text-green-100 text-sm font-medium mb-6 leading-relaxed">
                    {dict.member.helpDesc}
                  </p>
                  <div className="grid gap-3">
                    <a
                      href={`mailto:${String(memberPortalCfg.supportEmail || 'cepelak@pupen.org').trim()}`}
                      className="block w-full py-4 bg-white text-green-600 rounded-2xl font-black uppercase tracking-widest text-xs text-center hover:bg-green-50 transition"
                    >
                      {dict.member.writeSupport}
                    </a>
                    {memberPortalCfg.supportPhone && (
                      <a
                        href={`tel:${String(memberPortalCfg.supportPhone).replace(/\s+/g, '')}`}
                        className="block w-full py-4 bg-white text-green-600 rounded-2xl font-black uppercase tracking-widest text-xs text-center hover:bg-green-50 transition"
                      >
                        {ms.callSupport || (lang === 'en' ? 'Call support' : 'Zavolat podpoře')}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MEMBER CARD TAB */}
          {activeTab === 'card' && (
            <MemberCard lang={lang} user={user} profile={profile} />
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <NotificationsTab lang={lang} userEmail={user.email} />
          )}

          {/* MESSAGES TAB */}
          {activeTab === 'messages' && (
            <MemberMessagesTab lang={lang} />
          )}

          {/* GUIDELINES TAB */}
          {activeTab === 'guidelines' && (
            <GuidelinesTab lang={lang} />
          )}

          {/* GOVERNANCE TAB */}
          {activeTab === 'governance' && (
            <MemberGovernanceTab lang={lang} />
          )}

          {/* BOARD TAB */}
          {activeTab === 'board' && (
            <MemberBoardTab lang={lang} />
          )}

          {/* PROJECTS TAB */}
          {activeTab === 'projects' && (
            <ProjectsTab lang={lang} />
          )}

          {/* POLLS TAB */}
          {activeTab === 'polls' && (
            <MemberPollsTab lang={lang} />
          )}

          {/* MY EVENTS TAB */}
          {activeTab === 'my_events' && (
            <MyEventsTab lang={lang} userEmail={user.email} />
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
              <h2 className="text-2xl font-black mb-8 flex items-center gap-3"><FileText className="text-stone-900" /> {dict.member.internalDocs}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {internalDocs.length > 0 ? internalDocs.map((doc: any) => (
                  <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col p-6 bg-stone-50 rounded-[2rem] hover:bg-green-50 transition group border border-transparent hover:border-green-100">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-stone-400 group-hover:text-green-600 shadow-sm mb-4 transition">
                      <FileText size={24} />
                    </div>
                    <h3 className="font-bold text-stone-900 mb-2">{lang === 'en' && doc.title_en ? doc.title_en : doc.title}</h3>
                    <div className="flex items-center justify-between mt-auto pt-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                      <Download size={18} className="text-stone-300 group-hover:text-green-600 transition" />
                    </div>
                  </a>
                )) : (
                  <div className="col-span-full py-12 text-center text-stone-400 italic font-medium">{dict.member.noDocs}</div>
                )}
              </div>
            </div>
          )}

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
            <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
              <h2 className="text-2xl font-black mb-8 flex items-center gap-3"><Calendar className="text-stone-900" /> {dict.member.memberEvents}</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {memberEvents.length > 0 ? memberEvents.map((event: any) => (
                  <div key={event.id} className="p-6 bg-stone-50 rounded-[2.5rem] border border-transparent hover:border-amber-200 transition group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm group-hover:bg-amber-600 group-hover:text-white transition-all">
                        <Calendar size={28} />
                      </div>
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{ms.memberEventsBadge || (lang === 'en' ? 'Members only' : 'Akce pro členy')}</span>
                    </div>
                    <h3 className="text-xl font-black text-stone-900 mb-2">{lang === 'en' && event.title_en ? event.title_en : event.title}</h3>
                    <div className="space-y-2 mb-6">
                      <p className="text-stone-500 font-bold flex items-center gap-2"><Clock size={16} /> {new Date(event.date).toLocaleDateString()}</p>
                      <p className="text-stone-400 text-sm font-medium flex items-center gap-2"><Users size={16} /> {event.location}</p>
                    </div>
                    <Link href={`/${lang}/akce`} className="inline-flex items-center gap-2 text-stone-900 font-black uppercase tracking-widest text-[10px] hover:text-amber-600 transition">
                      {(ms.moreInfo || (lang === 'en' ? 'More info' : 'Více informací'))} <ArrowLeft size={14} className="rotate-180" />
                    </Link>
                  </div>
                )) : (
                  <div className="col-span-full py-12 text-center text-stone-400 italic font-medium">{dict.member.noEvents}</div>
                )}
              </div>
            </div>
          )}

          {/* DIRECTORY TAB */}
          {activeTab === 'directory' && (
            <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3"><Users className="text-stone-900" /> {dict.member.memberDirectory}</h2>
                <button
                  type="button"
                  onClick={() => setShowBlocked((v) => !v)}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                >
                  {showBlocked
                    ? (ms.directoryHideBlocked || (lang === 'en' ? 'Hide blocked' : 'Skrýt blokované'))
                    : (ms.directoryShowBlocked || (lang === 'en' ? 'Show blocked' : 'Zobrazit blokované'))}
                </button>
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-stone-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-100">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">{dict.member.firstName}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">{dict.member.lastName}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">E-mail</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">{dict.member.memberSince}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {directory
                      .filter((m: any) => showBlocked || !blocked[String(m.email || '').toLowerCase()])
                      .map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-stone-50/50 transition">
                        <td className="px-6 py-4 font-bold text-stone-700">{m.first_name}</td>
                        <td className="px-6 py-4 font-bold text-stone-700">{m.last_name}</td>
                        <td className="px-6 py-4 text-stone-500 font-medium">{m.email}</td>
                        <td className="px-6 py-4 text-stone-400 text-sm font-medium">
                          {m.member_since ? new Date(m.member_since).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => toggleBlocked(String(m.email))}
                              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                            >
                              {blocked[String(m.email || '').toLowerCase()]
                                ? (ms.directoryUnblock || (lang === 'en' ? 'Unblock' : 'Odblokovat'))
                                : (ms.directoryBlock || (lang === 'en' ? 'Block' : 'Blokovat'))}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setReportOpen({
                                  type: 'user',
                                  id: String(m.email),
                                  label: `${m.first_name || ''} ${m.last_name || ''}`.trim() || String(m.email),
                                })
                              }
                              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                            >
                              {ms.directoryReport || (lang === 'en' ? 'Report' : 'Nahlásit')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ARTICLES TAB */}
          {activeTab === 'articles' && (
            <MemberPanel className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3"><BookOpen className="text-stone-900" /> {dict.member.myArticles}</h2>
                  <Link href={`/${lang}/blog`} className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-stone-800 transition">{ms.writeArticle || (lang === 'en' ? 'Write new article' : 'Napsat nový článek')}</Link>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {myBlogs.length > 0 ? myBlogs.map((blog: any) => (
                  <Link key={blog.id} href={`/${lang}/novinky/${blog.id}`} className="flex items-center gap-6 p-6 bg-stone-50 rounded-[2.5rem] border border-transparent hover:border-blue-200 hover:bg-blue-50/30 transition group">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                      <FileText size={28} />
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="font-black text-stone-900 text-lg mb-1 truncate">{blog.title}</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-stone-400 font-black uppercase tracking-widest">{new Date(blog.created_at).toLocaleDateString()}</span>
                        <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
                        <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest">{blog.category}</span>
                      </div>
                    </div>
                    <ArrowLeft size={20} className="text-stone-300 group-hover:text-blue-600 transition rotate-180 shrink-0" />
                  </Link>
                )) : (
                  <div className="col-span-full py-12 text-center text-stone-400 italic font-medium">{dict.member.noArticles}</div>
                )}
              </div>
            </MemberPanel>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl">
              <MemberPanel className="p-10">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3"><Settings className="text-stone-900" /> {dict.member.profileSettings}</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">{dict.member.firstName}</label>
                      <input 
                        type="text"
                        required
                        value={editProfile.first_name}
                        onChange={e => setEditProfile({...editProfile, first_name: e.target.value})}
                        className="w-full bg-stone-50 border-stone-100 border rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">{dict.member.lastName}</label>
                      <input 
                        type="text"
                        required
                        value={editProfile.last_name}
                        onChange={e => setEditProfile({...editProfile, last_name: e.target.value})}
                        className="w-full bg-stone-50 border-stone-100 border rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">{dict.member.emailLabel}</label>
                    <input 
                      type="email"
                      disabled
                      value={user.email}
                      className="w-full bg-stone-100 border-none rounded-2xl px-5 py-4 font-bold text-stone-400 cursor-not-allowed"
                    />
                  </div>

                  <AvatarUploader
                    lang={lang}
                    userId={user.id}
                    currentUrl={profile?.avatar_url}
                    onUploaded={(url: string) => setProfile({ ...profile, avatar_url: url })}
                  />

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={isSavingProfile}
                      className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                    >
                      {isSavingProfile ? <InlinePulse className="bg-white/80" size={14} /> : <ShieldCheck size={20} />}
                      {dict.member.saveChanges}
                    </button>
                  </div>
                </form>
              </MemberPanel>
              <MemberPanel className="p-10 mt-8">
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <Settings className="text-stone-900" /> {ms.preferencesTitle || (lang === 'en' ? 'Preferences' : 'Preference')}
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                      {ms.defaultTabLabel || (lang === 'en' ? 'Default tab' : 'Výchozí záložka')}
                    </div>
                    <select
                      value={memberDefaultTab}
                      onChange={(e) => setMemberDefaultTab(e.target.value)}
                      className="w-full bg-stone-50 border-stone-100 border rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                    >
                      {[
                        ['dashboard', dict.member.tabDashboard],
                        ['events', dict.member.tabEvents],
                        ['documents', dict.member.tabDocuments],
                        ['card', lang === 'en' ? 'Member card' : 'Členská karta'],
                        ['messages', lang === 'en' ? 'Messages' : 'Zprávy'],
                        ['settings', dict.member.tabSettings],
                      ]
                        .filter(([id]) => !memberPortalCfg.hiddenTabs.includes(id))
                        .map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={saveMemberPrefs}
                    disabled={uiPrefsSaving}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-green-600 transition shadow-lg shadow-stone-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uiPrefsSaving ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={18} />}
                    {ms.savePreferences || (lang === 'en' ? 'Save preferences' : 'Uložit preference')}
                  </button>
                </div>
              </MemberPanel>
              <MemberPanel className="p-10 mt-8">
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <KeyRound className="text-stone-900" /> {ms.passwordTitle || (lang === 'en' ? 'Password' : 'Heslo')}
                </h2>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                      {ms.newPassword || (lang === 'en' ? 'New password' : 'Nové heslo')}
                    </label>
                    <PasswordField
                      value={pw1}
                      onChange={setPw1}
                      placeholder="••••••••"
                      inputClassName="w-full bg-stone-50 border-stone-100 border rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                      buttonClassName="absolute right-5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-700 transition"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                      {ms.confirmPassword || (lang === 'en' ? 'Confirm password' : 'Potvrzení hesla')}
                    </label>
                    <PasswordField
                      value={pw2}
                      onChange={setPw2}
                      placeholder="••••••••"
                      inputClassName="w-full bg-stone-50 border-stone-100 border rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                      buttonClassName="absolute right-5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-700 transition"
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={pwSaving}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {pwSaving ? <InlinePulse className="bg-white/80" size={14} /> : <ShieldCheck size={20} />}
                    {ms.savePassword || (lang === 'en' ? 'Save password' : 'Uložit heslo')}
                  </button>
                </div>
              </MemberPanel>
              <MemberPanel className="p-10 mt-8">
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <ShieldCheck className="text-stone-900" /> {ms.securityTitle || (lang === 'en' ? 'Security' : 'Zabezpečení')}
                </h2>

                <div className="space-y-6">
                  <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                      {ms.twoFactorTitle || (lang === 'en' ? 'Two-factor authentication (2FA)' : 'Dvoufaktorové ověření (2FA)')}
                    </div>
                    <div className="mt-2 font-bold text-stone-700">
                      {mfaEnabled
                        ? (ms.enabled || (lang === 'en' ? 'Enabled' : 'Zapnuto'))
                        : (ms.disabled || (lang === 'en' ? 'Disabled' : 'Vypnuto'))}
                    </div>

                    {mfaEnrollQr ? (
                      <div className="mt-6 grid md:grid-cols-2 gap-6 items-start">
                        <div className="bg-white border border-stone-100 rounded-2xl p-4 flex items-center justify-center">
                          <img src={mfaEnrollQr} alt="2FA QR" className="w-full max-w-[260px]" />
                        </div>
                        <div className="space-y-4">
                          <div className="text-sm text-stone-600 font-medium">
                            {ms.twoFactorScanHint ||
                              (lang === 'en'
                                ? 'Scan the QR code in your authenticator app and enter the 6-digit code.'
                                : 'Naskenujte QR kód v autentizační aplikaci a zadejte 6místný kód.')}
                          </div>
                          <input
                            value={mfaVerifyCode}
                            onChange={(e) => setMfaVerifyCode(e.target.value)}
                            inputMode="numeric"
                            className="w-full bg-white border border-stone-200 rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                            placeholder="123456"
                          />
                          <button
                            type="button"
                            onClick={verifyMfaEnroll}
                            disabled={mfaLoading || !mfaVerifyCode}
                            className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {mfaLoading ? <InlinePulse className="bg-white/80" size={14} /> : <ShieldCheck size={18} />}
                            {ms.verify || (lang === 'en' ? 'Verify' : 'Ověřit')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 grid sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={startMfaEnroll}
                          disabled={mfaLoading || mfaEnabled}
                          className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition disabled:opacity-50"
                        >
                          {mfaLoading
                            ? (ms.loading || (lang === 'en' ? 'Loading...' : 'Načítám...'))
                            : (ms.enable2fa || (lang === 'en' ? 'Enable 2FA' : 'Zapnout 2FA'))}
                        </button>
                        <button
                          type="button"
                          onClick={disableMfa}
                          disabled={mfaLoading || !mfaEnabled}
                          className="w-full py-4 bg-white text-stone-700 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
                        >
                          {ms.disable2fa || (lang === 'en' ? 'Disable 2FA' : 'Vypnout 2FA')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                      {ms.googleTitle || (lang === 'en' ? 'Google account' : 'Google účet')}
                    </div>
                    <div className="mt-2 text-sm text-stone-600 font-medium">
                      {ms.googleSubtitle ||
                        (lang === 'en'
                          ? 'Link your Google account to sign in with Google.'
                          : 'Propojte Google účet pro přihlašování přes Google.')}
                    </div>
                    <button
                      type="button"
                      onClick={linkGoogle}
                      disabled={googleBusy}
                      className="mt-4 w-full py-4 bg-white text-stone-700 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      {googleBusy
                        ? (ms.redirecting || (lang === 'en' ? 'Redirecting...' : 'Přesměrovávám...'))
                        : (ms.googleLink || (lang === 'en' ? 'Link Google' : 'Propojit Google'))}
                    </button>
                  </div>
                </div>
              </MemberPanel>
              <MemberPanel className="p-10 mt-8">
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <Mail className="text-stone-900" /> {ms.emailPrefsTitle || (lang === 'en' ? 'Email preferences' : 'E-mail preference')}
                </h2>
                <div className="space-y-6">
                  <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                          {ms.weeklyDigestTitle || (lang === 'en' ? 'Weekly digest' : 'Týdenní digest')}
                        </div>
                        <div className="font-bold text-stone-700">
                          {ms.weeklyDigestDesc || (lang === 'en' ? 'Receive weekly summary emails.' : 'Dostávat týdenní souhrn e-mailem.')}
                        </div>
                      </div>
                      {prefsLoading ? (
                        <InlinePulse className="bg-stone-300" size={14} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEmailPrefs((p: any) => ({ ...p, digestWeekly: !p.digestWeekly }))}
                          className={`shrink-0 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            emailPrefs.digestWeekly ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {emailPrefs.digestWeekly
                            ? (ms.on || (lang === 'en' ? 'On' : 'Zapnuto'))
                            : (ms.off || (lang === 'en' ? 'Off' : 'Vypnuto'))}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                      {ms.categoriesTitle || (lang === 'en' ? 'Categories' : 'Kategorie')}
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {[
                        { k: 'events', label: ms.categoryEvents || (lang === 'en' ? 'Events' : 'Akce') },
                        { k: 'community', label: ms.categoryCommunity || (lang === 'en' ? 'Community' : 'Komunita') },
                        { k: 'finance', label: ms.categoryFinance || (lang === 'en' ? 'Finance' : 'Finance') },
                        { k: 'news', label: ms.categoryNews || (lang === 'en' ? 'News' : 'Novinky') },
                      ].map((x) => (
                        <button
                          key={x.k}
                          type="button"
                          onClick={() =>
                            setEmailPrefs((p: any) => ({
                              ...p,
                              categories: { ...(p.categories || {}), [x.k]: !(p.categories || {})[x.k] },
                            }))
                          }
                          className={`px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            (emailPrefs.categories || {})[x.k]
                              ? 'bg-green-600 text-white border-green-600 shadow-lg'
                              : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {x.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveEmailPrefs}
                    disabled={prefsSaving}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {prefsSaving ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={18} />}
                    {ms.savePreferences || (lang === 'en' ? 'Save preferences' : 'Uložit preference')}
                  </button>
                </div>
              </MemberPanel>

              <MemberPanel className="p-10 mt-8">
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <FileCheck className="text-stone-900" /> {ms.gdprTitle || 'GDPR'}
                </h2>
                <div className="space-y-4">
                  <div className="text-stone-600 font-medium">
                    {ms.gdprDesc ||
                      (lang === 'en'
                        ? 'You can download your personal data export or request deletion.'
                        : 'Můžete si stáhnout export osobních údajů nebo požádat o smazání.')}
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={downloadGdprExport}
                      className="w-full py-4 bg-white text-stone-700 rounded-2xl font-bold hover:bg-stone-50 transition border border-stone-200 flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      {ms.gdprDownload || (lang === 'en' ? 'Download export' : 'Stáhnout export')}
                    </button>
                    <button
                      type="button"
                      onClick={requestGdprDelete}
                      className="w-full py-4 bg-red-50 text-red-700 rounded-2xl font-bold hover:bg-red-100 transition border border-red-200 flex items-center justify-center gap-2"
                    >
                      <X size={18} />
                      {ms.gdprRequestDelete || (lang === 'en' ? 'Request deletion' : 'Požádat o smazání')}
                    </button>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                    {ms.gdprDeleteNote ||
                      (lang === 'en'
                        ? 'Deletion is handled manually by admins.'
                        : 'Smazání je řešeno manuálně administrátory.')}
                  </div>
                </div>
            </MemberPanel>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
