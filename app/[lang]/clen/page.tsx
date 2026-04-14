'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Lock, ShieldCheck, FileText, Download, Users, 
  ArrowLeft, FileCheck, BookOpen, Clock, 
  Mail, X, Calendar, Settings, Save, KeyRound
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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
import AddressAutocomplete from '@/app/components/AddressAutocomplete';
import ConfirmModal from '@/app/components/ConfirmModal';
import Dialog from '@/app/components/ui/Dialog';
import { evaluatePassword, passwordScoreLabel } from '@/lib/auth/password-policy';

const passthroughLoader = ({ src }: { src: string }) => src;

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
const ReleaseNotesTab = dynamic<any>(() => import('./components/ReleaseNotesTab'), { loading: () => <SkeletonTabContent /> });
const MemberDirectoryMap = dynamic<any>(() => import('./components/MemberDirectoryMap'), { loading: () => <SkeletonTabContent /> });

export default function ClenskaSekcePage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const router = useRouter();
  const { showToast } = useToast();
  const didInitTabRef = useRef(false);
  
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
  const [memberDefaultTab, setMemberDefaultTab] = useState('dashboard');
  const [uiPrefsSaving, setUiPrefsSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState<null | { type: 'user' | 'content'; id: string; label: string }>(null);
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [showBlocked, setShowBlocked] = useState(false);
  const [directoryQuery, setDirectoryQuery] = useState('');
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
  const [gdprDeleteOpen, setGdprDeleteOpen] = useState(false);

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
    const preferred = memberPortalCfg.defaultTab && !hidden.has(memberPortalCfg.defaultTab) ? memberPortalCfg.defaultTab : 'dashboard';
    setActiveTab((prev) => (hidden.has(prev) ? preferred : prev));
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
  const [editProfile, setEditProfile] = useState({ first_name: '', last_name: '', address: '', marketing_consent: true });
  const [editAddressMeta, setEditAddressMeta] = useState<any>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string>('');
  const [mfaEnrollQr, setMfaEnrollQr] = useState<string>('');
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaDisableOpen, setMfaDisableOpen] = useState(false);
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [passkeysLoading, setPasskeysLoading] = useState(false);
  const [passkeyFriendlyName, setPasskeyFriendlyName] = useState('');
  const [passkeyFactors, setPasskeyFactors] = useState<any[]>([]);
  const googleAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
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

      const isSuperAdmin = !!prof?.can_manage_admins;
      const hasMemberPortal = !!(prof?.is_member || prof?.is_admin || prof?.can_manage_admins || prof?.can_view_member_portal || prof?.can_edit_member_portal);
      if (!hasMemberPortal) {
        router.replace(`/${lang}/login`);
        return;
      }

      const userProf = prof || null;
      setProfile(userProf);

      if (!isSuperAdmin && userProf && !(userProf as any).member_no) {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            const res = await fetch('/api/member/assign-number', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json().catch(() => ({}));
            if (res.ok && json?.memberNo) setProfile((p: any) => (p ? { ...p, member_no: json.memberNo } : p));
          }
        } catch {}
      }

      const prefTab = (userProf as any)?.ui_prefs?.member?.defaultTab ? String((userProf as any).ui_prefs.member.defaultTab) : '';
      if (prefTab) setMemberDefaultTab(prefTab);
      if (prefTab && !didInitTabRef.current) {
        setActiveTab(prefTab);
        didInitTabRef.current = true;
      }
      setEditProfile({ 
        first_name: userProf?.first_name || '', 
        last_name: userProf?.last_name || '',
        address: (userProf as any)?.address || '',
        marketing_consent: (userProf as any)?.marketing_consent !== false
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

  useEffect(() => {
    if (!user?.email) return;
    setPrefsLoading(true);
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/newsletter/preferences', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (d.preferences) {
          const cats = d.preferences.categories || [];
          setEmailPrefs({
            digestWeekly: d.preferences.consent,
            categories: {
              events: cats.includes('all') || cats.includes('Akce') || cats.includes('events'),
              community: cats.includes('all') || cats.includes('Komunita') || cats.includes('community'),
              finance: cats.includes('all') || cats.includes('Finance') || cats.includes('finance'),
              news: cats.includes('all') || cats.includes('Novinky') || cats.includes('news')
            }
          });
        }
      } catch {
      } finally {
        setPrefsLoading(false);
      }
    })();
  }, [user]);

  const saveEmailPrefs = async () => {
    setPrefsSaving(true);
    try {
      const cats = Object.entries(emailPrefs.categories)
        .filter(([, v]) => !!v)
        .map(([k]) => {
          if (k === 'events') return 'Akce';
          if (k === 'community') return 'Komunita';
          if (k === 'finance') return 'Finance';
          if (k === 'news') return 'Novinky';
          return k;
        });

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Not signed in' : 'Nejste přihlášen.');

      const res = await fetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          categories: cats,
          hp: ''
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      showToast(lang === 'en' ? 'Preferences updated' : 'Preference uloženy', 'success');
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

  const downloadGdprExport = async (format: 'json' | 'pdf' = 'json') => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const endpoint = format === 'pdf' ? '/api/gdpr/export-pdf' : '/api/gdpr/export';
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Request failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pupen_gdpr_export_${new Date().toISOString().slice(0, 10)}.${format}`;
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
    setGdprDeleteOpen(true);
  };

  const doRequestGdprDelete = async () => {
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
      let validatedAddress = String(editProfile.address || '').trim();
      let validatedMeta: any = editAddressMeta;
      if (validatedAddress && validatedAddress !== String(profile?.address || '').trim()) {
        const res = await fetch('/api/address/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: validatedAddress, lang }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(lang === 'en' ? 'Please enter a valid address.' : 'Zadejte prosím platnou adresu.');
        validatedAddress = String(json?.address || validatedAddress);
        validatedMeta = json?.meta || validatedMeta;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editProfile.first_name,
          last_name: editProfile.last_name,
          address: validatedAddress,
          address_meta: validatedAddress ? (validatedMeta || {}) : {},
          address_validated_at: validatedAddress ? new Date().toISOString() : null,
          marketing_consent: editProfile.marketing_consent !== false,
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setProfile({ ...profile, ...editProfile, address: validatedAddress, marketing_consent: editProfile.marketing_consent !== false } as any);
      showToast(dict.member.profileUpdated, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    const pw = evaluatePassword(pw1);
    if (!pw.ok) {
      showToast(lang === 'en' ? 'Password does not meet policy.' : 'Heslo nesplňuje požadavky.', 'error');
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

  const refreshPasskeys = async () => {
    const authAny: any = supabase.auth as any;
    if (!authAny?.mfa?.listFactors) return;
    setPasskeysLoading(true);
    try {
      const res = await authAny.mfa.listFactors();
      if (res?.error) throw res.error;
      const all = res?.data?.all || [];
      const webauthn = Array.isArray(all) ? all.filter((f: any) => f?.factor_type === 'webauthn') : [];
      setPasskeyFactors(webauthn);
    } catch {
      setPasskeyFactors([]);
    } finally {
      setPasskeysLoading(false);
    }
  };

  useEffect(() => {
    refreshPasskeys();
  }, []);

  const registerPasskey = async () => {
    const authAny: any = supabase.auth as any;
    if (!authAny?.mfa?.webauthn?.register) {
      showToast(lang === 'en' ? 'Passkeys are not supported.' : 'Passkeys nejsou podporované.', 'error');
      return;
    }
    if (typeof window !== 'undefined') {
      if (!window.isSecureContext) {
        showToast(lang === 'en' ? 'Passkeys require HTTPS.' : 'Passkeys vyžadují HTTPS.', 'error');
        return;
      }
      if (!(window as any).PublicKeyCredential) {
        showToast(lang === 'en' ? 'Passkeys are not supported in this browser.' : 'V tomto prohlížeči nejsou passkeys podporované.', 'error');
        return;
      }
    }
    setPasskeysLoading(true);
    try {
      await logSecurityEvent('PASSKEY_REGISTER_START', {});
      const friendlyName = String(passkeyFriendlyName || '').trim() || (lang === 'en' ? 'Passkey' : 'Passkey');
      const res = await authAny.mfa.webauthn.register({ friendlyName });
      if (res?.error) throw res.error;
      setPasskeyFriendlyName('');
      await refreshPasskeys();
      showToast(lang === 'en' ? 'Passkey added.' : 'Passkey přidán.', 'success');
      await logSecurityEvent('PASSKEY_REGISTERED', {});
    } catch (e: any) {
      const msg = String(e?.message || 'Chyba');
      if (msg.toLowerCase().includes('mfa enroll is disabled for webauthn')) {
        showToast(
          lang === 'en'
            ? 'Passkeys are disabled in Supabase (Auth → MFA → WebAuthn).'
            : 'Passkeys nejsou povolené v Supabase (Auth → MFA → WebAuthn).',
          'error',
        );
      } else if (msg.toLowerCase().includes('notallowederror') || msg.toLowerCase().includes('not allowed')) {
        showToast(lang === 'en' ? 'Passkey action was cancelled.' : 'Akce passkey byla zrušena.', 'error');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setPasskeysLoading(false);
    }
  };

  const removePasskey = async (factorId: string) => {
    const authAny: any = supabase.auth as any;
    if (!authAny?.mfa?.unenroll) return;
    setPasskeysLoading(true);
    try {
      const res = await authAny.mfa.unenroll({ factorId });
      if (res?.error) throw res.error;
      await refreshPasskeys();
      showToast(lang === 'en' ? 'Passkey removed.' : 'Passkey odebrán.', 'success');
      await logSecurityEvent('PASSKEY_REMOVED', {});
    } catch (e: any) {
      const msg = String(e?.message || 'Chyba');
      if (msg.toLowerCase().includes('aal2')) {
        showToast(lang === 'en' ? 'Verify 2FA code to remove passkey.' : 'Pro odebrání passkey nejdřív ověř 2FA kódem.', 'error');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setPasskeysLoading(false);
    }
  };

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
      const rawUri = String(res?.data?.totp?.uri || res?.data?.totp?.qr_code || '');
      if (!factorId || !rawUri) throw new Error('Enroll failed');

      const { data: sessionData } = await supabase.auth.getSession();
      const account = String(sessionData.session?.user?.email || '').trim();

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

      setMfaFactorId(factorId);
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
    if (!mfaEnabled || !mfaFactorId) return;
    setMfaDisableCode('');
    setMfaDisableOpen(true);
  };

  const confirmDisableMfa = async () => {
    const authAny: any = supabase.auth as any;
    if (!authAny?.mfa?.unenroll || !authAny?.mfa?.challenge || !authAny?.mfa?.verify || !mfaFactorId) return;
    const code = String(mfaDisableCode || '').trim();
    if (!code) return;
    setMfaLoading(true);
    try {
      const ch = await authAny.mfa.challenge({ factorId: mfaFactorId });
      const challengeId = String(ch?.data?.id || ch?.data?.challengeId || '');
      if (!challengeId) throw new Error('Challenge failed');
      const v = await authAny.mfa.verify({ factorId: mfaFactorId, challengeId, code });
      if (v?.error) throw v.error;

      const res = await authAny.mfa.unenroll({ factorId: mfaFactorId });
      if (res?.error) throw res.error;
      setMfaDisableOpen(false);
      setMfaDisableCode('');
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
    if (!googleAuthEnabled) return;
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

  const downloadMyApplicationPdf = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/member/my-application/pdf', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Chyba');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prihlaska_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(lang === 'en' ? 'Downloaded.' : 'Staženo.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  // Načtení dat (Queries)
  const { data: internalDocs = [] } = useQuery({
    queryKey: ['internal_docs'],
    enabled: !!user && !!profile,
    queryFn: async () => {
      let q: any = supabase
        .from('documents')
        .select('*')
        .eq('is_member_only', true)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!(profile?.is_admin || profile?.can_manage_admins)) {
        q = q.neq('access_level', 'admin');
      }
      const { data } = await q;
      return data || [];
    }
  });

  const { data: myApplication } = useQuery({
    queryKey: ['member_my_application', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return null;
      const res = await fetch('/api/member/my-application', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return json?.application || null;
    },
  });

  const { data: memberEvents = [] } = useQuery({
    queryKey: ['member_events'],
    enabled: !!user,
    queryFn: async () => {
      const run = (withMemberFilter: boolean) => {
        let q = supabase
          .from('events')
          .select('*')
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true })
          .limit(100);
        if (withMemberFilter) q = q.eq('is_member_only', true);
        return q;
      };
      let res = await run(true);
      if (res.error && /is_member_only/i.test(res.error.message) && /schema cache/i.test(res.error.message)) {
        res = await run(false);
      }
      return res.data || [];
    }
  });

  const { data: directory = [] } = useQuery({
    queryKey: ['member_directory'],
    enabled: !!user && !!profile?.is_member && activeTab === 'directory',
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, member_since, address_meta')
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

  const { data: badgeStats } = useQuery({
    queryKey: ['member_badges_stats', user?.id, user?.email],
    enabled: !!user && activeTab === 'badges',
    queryFn: async () => {
      const email = String(user?.email || '').trim();
      const [attRes, payRes] = await Promise.all([
        email
          ? supabase.from('rsvp').select('id', { count: 'exact', head: true }).eq('email', email).eq('checked_in', true)
          : Promise.resolve({ count: 0, error: null } as any),
        supabase.from('membership_payments').select('id', { count: 'exact', head: true }).eq('member_id', user.id),
      ]);
      if (attRes.error) throw attRes.error;
      if (payRes.error) throw payRes.error;
      return { attendance: attRes.count || 0, payments: payRes.count || 0 };
    },
  });

  const { data: memberBadges = [] } = useQuery({
    queryKey: ['member_badges', user?.id],
    enabled: !!user && activeTab === 'badges',
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return [];
      const res = await fetch('/api/member/badges', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return Array.isArray(json?.badges) ? json.badges : [];
    },
  });

  if (loading || !dict) return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100/40 lg:pl-72">
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
  const hasAccessToMemberPortal =
    !!(profile?.is_member || profile?.is_admin || profile?.can_manage_admins || profile?.can_view_member_portal || profile?.can_edit_member_portal);

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
      <ConfirmModal
        isOpen={gdprDeleteOpen}
        onClose={() => setGdprDeleteOpen(false)}
        onConfirm={doRequestGdprDelete}
        title={lang === 'en' ? 'Send deletion request?' : 'Odeslat žádost o smazání?'}
        message={
          lang === 'en'
            ? 'This does not delete data immediately. Admins will process the request.'
            : 'Data se nesmažou okamžitě. Administrátoři žádost zpracují.'
        }
        confirmLabel={lang === 'en' ? 'Send request' : 'Odeslat žádost'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Zrušit'}
        variant="warning"
      />
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
                                ? (dict.member.appApproved || (lang === 'en' ? 'Application approved' : 'Přihláška schválena'))
                                : myApplication.status === 'rejected'
                                  ? (dict.member.appRejected || (lang === 'en' ? 'Application rejected' : 'Přihláška zamítnuta'))
                                  : (dict.member.appPending || (lang === 'en' ? 'Application pending' : 'Přihláška evidována')))
                            : (dict.member.appMissing || (lang === 'en' ? 'Application not found' : 'Přihláška nenalezena'))}
                        </p>
                        <p className="text-xs text-stone-400 font-medium uppercase tracking-widest">
                          {myApplication?.status === 'approved'
                            ? (dict.member.officialMember || (lang === 'en' ? 'Official member' : 'Oficiální člen'))
                            : myApplication?.status === 'rejected'
                              ? (dict.member.notMember || (lang === 'en' ? 'Not a member' : 'Není člen'))
                              : (dict.member.awaitingReview || (lang === 'en' ? 'Awaiting review' : 'Čeká na kontrolu'))}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={downloadMyApplicationPdf}
                        disabled={!myApplication}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition disabled:opacity-50"
                      >
                        <Download size={14} /> {lang === 'en' ? 'Download PDF' : 'Stáhnout PDF'}
                      </button>
                      <Link
                        href={`/${lang}/clen/prihlaska`}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-stone-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-100 transition shadow-sm border border-stone-100"
                      >
                        <FileText size={14} /> {dict.member.downloadApp || (lang === 'en' ? 'Open / Print' : 'Otevřít / Tisk')}
                      </Link>
                    </div>
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
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">{new Date(event.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')} • {event.location}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-stone-400 font-medium italic">{dict.member.noEvents || (lang === 'en' ? 'No events found.' : 'Žádné akce nenalezeny.')}</p>
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
                      <p className="text-xs text-stone-400 italic text-center py-4">{dict.member.noDocs || (lang === 'en' ? 'No documents found.' : 'Žádné dokumenty nenalezeny.')}</p>
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
                      href={`mailto:${String(memberPortalCfg.supportEmail || 'support@pupen.org').trim()}`}
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

          {/* RELEASE NOTES TAB */}
          {activeTab === 'release_notes' && (
            <ReleaseNotesTab />
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

          {/* BADGES TAB */}
          {activeTab === 'badges' && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                  <span className="text-amber-500">★</span> {lang === 'en' ? 'My Badges' : 'Moje odznaky'}
                </h2>
                
                {memberBadges.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {memberBadges.map((ub: any) => {
                      const badge = ub.gamification_badges;
                      return (
                        <div key={ub.id} className="p-6 bg-stone-50 rounded-[2rem] border border-stone-100 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-bl-[1.5rem] font-black text-[10px] uppercase tracking-widest">
                            {new Date(ub.awarded_at).toLocaleDateString()}
                          </div>
                          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm mb-4 border border-stone-100 overflow-hidden relative">
                            {badge?.icon ? (
                              <Image
                                loader={passthroughLoader}
                                unoptimized
                                src={badge.icon}
                                alt={String(badge?.name || '')}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-amber-500 text-2xl">★</span>
                            )}
                          </div>
                          <h3 className="font-black text-stone-900 text-lg leading-tight mb-2">{badge?.name}</h3>
                          <p className="text-xs font-bold text-stone-500 mb-4">{badge?.description}</p>
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-stone-200 text-stone-600 rounded text-[10px] font-black uppercase tracking-widest">
                            +{badge?.points || 0} bodů
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-stone-400 italic font-medium bg-stone-50 rounded-[2rem]">
                    {lang === 'en' ? 'You have no badges yet. Keep participating!' : 'Zatím nemáte žádné odznaky. Zapojte se do aktivit!'}
                  </div>
                )}
              </div>

              <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                  <span className="text-stone-400">📊</span> {lang === 'en' ? 'Progress & Milestones' : 'Progres a milníky'}
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const attendance = badgeStats?.attendance || 0;
                  const payments = badgeStats?.payments || 0;
                  const hasPasskey = passkeyFactors.length > 0;
                  const has2fa = !!mfaEnabled;
                  const isMember = !!profile?.is_member;
                  const hasMemberNo = !!profile?.member_no;
                  const hasProfileBasics = !!(profile?.first_name && profile?.last_name && profile?.address);
                  const items = [
                    {
                      k: 'member',
                      title: lang === 'en' ? 'Member' : 'Člen',
                      desc: lang === 'en' ? 'Approved membership.' : 'Schválené členství.',
                      ok: isMember,
                    },
                    {
                      k: 'profile',
                      title: lang === 'en' ? 'Profile complete' : 'Profil vyplněn',
                      desc: lang === 'en' ? 'Name + address filled in.' : 'Jméno + adresa vyplněna.',
                      ok: hasProfileBasics,
                    },
                    {
                      k: 'member_no',
                      title: lang === 'en' ? 'Member number' : 'Členské číslo',
                      desc: lang === 'en' ? 'Member number assigned.' : 'Přiřazené členské číslo.',
                      ok: hasMemberNo,
                    },
                    {
                      k: 'payment',
                      title: lang === 'en' ? 'Membership paid' : 'Zaplaceno',
                      desc: lang === 'en' ? 'At least one membership payment.' : 'Alespoň jedna platba členství.',
                      ok: payments >= 1,
                    },
                    {
                      k: 'event_1',
                      title: lang === 'en' ? 'First event' : 'První akce',
                      desc: lang === 'en' ? 'Checked in at an event.' : 'Odbavení na akci.',
                      ok: attendance >= 1,
                    },
                    {
                      k: 'event_5',
                      title: lang === 'en' ? 'Regular' : 'Pravidelný účastník',
                      desc: lang === 'en' ? '5 checked-in events.' : '5 odbavených akcí.',
                      ok: attendance >= 5,
                    },
                    {
                      k: '2fa',
                      title: lang === 'en' ? '2FA enabled' : '2FA zapnuté',
                      desc: lang === 'en' ? 'Extra account protection.' : 'Extra ochrana účtu.',
                      ok: has2fa,
                    },
                    {
                      k: 'passkey',
                      title: lang === 'en' ? 'Passkey' : 'Passkey',
                      desc: lang === 'en' ? 'Passkey added.' : 'Přidaný passkey.',
                      ok: hasPasskey,
                    },
                  ];

                  return items.map((b) => (
                    <div
                      key={b.k}
                      className={`rounded-[2rem] border p-6 transition ${
                        b.ok ? 'bg-green-50 border-green-100' : 'bg-stone-50 border-stone-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                            {b.ok ? (lang === 'en' ? 'Unlocked' : 'Odemčeno') : (lang === 'en' ? 'Locked' : 'Zamčeno')}
                          </div>
                          <div className="mt-2 text-lg font-black text-stone-900 truncate">{b.title}</div>
                        </div>
                        <div
                          className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                            b.ok ? 'bg-green-600 text-white' : 'bg-white text-stone-300 border border-stone-200'
                          }`}
                        >
                          {b.ok ? '✓' : '•'}
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-stone-600 font-medium">{b.desc}</div>
                    </div>
                  ));
                })()}
                </div>
              </div>
            </div>
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
                  <button
                    key={doc.id}
                    type="button"
                    onClick={async () => {
                      try {
                        const { data } = await supabase.auth.getSession();
                        const token = data.session?.access_token;
                        if (!token) throw new Error('Unauthorized');
                        const res = await fetch('/api/documents/signed-url', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ documentId: doc.id }),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(json?.error || 'Chyba');
                        const url = String(json?.url || '');
                        if (url) window.open(url, '_blank', 'noopener,noreferrer');
                        else window.open(String(doc.file_url || ''), '_blank', 'noopener,noreferrer');
                      } catch {
                        window.open(String(doc.file_url || ''), '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="flex flex-col text-left p-6 bg-stone-50 rounded-[2rem] hover:bg-green-50 transition group border border-transparent hover:border-green-100"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-stone-400 group-hover:text-green-600 shadow-sm mb-4 transition">
                      <FileText size={24} />
                    </div>
                    <h3 className="font-bold text-stone-900 mb-2">{lang === 'en' && doc.title_en ? doc.title_en : doc.title}</h3>
                    <div className="flex items-center justify-between mt-auto pt-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{new Date(doc.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}</span>
                      <Download size={18} className="text-stone-300 group-hover:text-green-600 transition" />
                    </div>
                  </button>
                )) : (
                  <div className="col-span-full py-12 text-center text-stone-400 italic font-medium">{dict.member.noDocs || (lang === 'en' ? 'No documents found.' : 'Žádné dokumenty nenalezeny.')}</div>
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
                      <p className="text-stone-500 font-bold flex items-center gap-2"><Clock size={16} /> {new Date(event.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}</p>
                      <p className="text-stone-400 text-sm font-medium flex items-center gap-2"><Users size={16} /> {event.location}</p>
                    </div>
                    <Link href={`/${lang}/akce`} className="inline-flex items-center gap-2 text-stone-900 font-black uppercase tracking-widest text-[10px] hover:text-amber-600 transition">
                      {(ms.moreInfo || (lang === 'en' ? 'More info' : 'Více informací'))} <ArrowLeft size={14} className="rotate-180" />
                    </Link>
                  </div>
                )) : (
                  <div className="col-span-full py-12 text-center text-stone-400 italic font-medium">{dict.member.noEvents || (lang === 'en' ? 'No events found.' : 'Žádné akce nenalezeny.')}</div>
                )}
              </div>
            </div>
          )}

          {/* DIRECTORY TAB */}
          {activeTab === 'directory' && (
            <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3"><Users className="text-stone-900" /> {dict.member.memberDirectory}</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={directoryQuery}
                    onChange={(e) => setDirectoryQuery(e.target.value)}
                    className="bg-white border border-stone-200 rounded-xl px-5 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition w-full sm:w-[320px]"
                    placeholder={(dict as any)?.common?.searchPlaceholder || (lang === 'en' ? 'Search…' : 'Vyhledat…')}
                  />
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
              </div>

              <div className="mb-8">
                <MemberDirectoryMap
                  labels={{
                    title: (dict as any)?.memberDirectory?.mapTitle || (lang === 'en' ? 'Member locations (by city)' : 'Lokace členů (po městech)'),
                    membersLabel: (dict as any)?.memberDirectory?.membersLabel || (lang === 'en' ? 'members' : 'členů'),
                  }}
                  members={directory
                    .filter((m: any) => showBlocked || !blocked[String(m.email || '').toLowerCase()])
                    .filter((m: any) => {
                      const q = String(directoryQuery || '').trim().toLowerCase();
                      if (!q) return true;
                      const hay = [
                        m?.first_name,
                        m?.last_name,
                        m?.email,
                        m?.address_meta?.city,
                      ]
                        .map((x: any) => String(x || '').toLowerCase())
                        .join(' ');
                      return hay.includes(q);
                    })}
                />
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-stone-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-100">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">{dict.member.firstName || (lang === 'en' ? 'First name' : 'Jméno')}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">{dict.member.lastName || (lang === 'en' ? 'Last name' : 'Příjmení')}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">E-mail</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">{dict.member.memberSince || (lang === 'en' ? 'Member since' : 'Členem od')}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {directory
                      .filter((m: any) => showBlocked || !blocked[String(m.email || '').toLowerCase()])
                      .filter((m: any) => {
                        const q = String(directoryQuery || '').trim().toLowerCase();
                        if (!q) return true;
                        const hay = [
                          m?.first_name,
                          m?.last_name,
                          m?.email,
                          m?.address_meta?.city,
                        ]
                          .map((x: any) => String(x || '').toLowerCase())
                          .join(' ');
                        return hay.includes(q);
                      })
                      .map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-stone-50/50 transition">
                        <td className="px-6 py-4 font-bold text-stone-700">{m.first_name}</td>
                        <td className="px-6 py-4 font-bold text-stone-700">{m.last_name}</td>
                        <td className="px-6 py-4 text-stone-500 font-medium">{m.email}</td>
                        <td className="px-6 py-4 text-stone-400 text-sm font-medium">
                          {m.member_since ? new Date(m.member_since).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ') : '-'}
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
                        <span className="text-[10px] text-stone-400 font-black uppercase tracking-widest">{new Date(blog.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}</span>
                        <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
                        <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest">{blog.category}</span>
                      </div>
                    </div>
                    <ArrowLeft size={20} className="text-stone-300 group-hover:text-blue-600 transition rotate-180 shrink-0" />
                  </Link>
                )) : (
                  <div className="col-span-full py-12 text-center text-stone-400 italic font-medium">{dict.member.noArticles || (lang === 'en' ? 'No articles found.' : 'Žádné články nenalezeny.')}</div>
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
                      className="w-full bg-stone-100 border-none rounded-2xl px-5 py-4 font-bold text-stone-500 opacity-70 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest px-1 mt-2">{dict.member.emailHelp || (lang === 'en' ? 'Email cannot be changed.' : 'E-mail nelze změnit.')}</p>
                  </div>

                  <div className="pt-6 border-t border-stone-100">
                    <h3 className="font-bold text-stone-900 mb-4">{lang === 'en' ? 'Email preferences' : 'E-mailové preference'}</h3>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-start">
                          <input type="checkbox" className="peer sr-only" checked={true} disabled />
                          <div className="w-5 h-5 border-2 border-stone-300 rounded bg-stone-100 peer-checked:bg-stone-300 peer-checked:border-stone-300 transition flex items-center justify-center">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-stone-700 text-sm">{lang === 'en' ? 'Transactional emails' : 'Transakční e-maily'}</p>
                          <p className="text-xs text-stone-400">{lang === 'en' ? 'Required for account operations (applications, payments, password reset).' : 'Nutné pro fungování účtu (přihlášky, platby, obnova hesla).'}</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-start pt-0.5">
                          <input 
                            type="checkbox" 
                            className="peer sr-only" 
                            checked={editProfile.marketing_consent !== false}
                            onChange={(e) => setEditProfile({...editProfile, marketing_consent: e.target.checked})}
                          />
                          <div className="w-5 h-5 border-2 border-stone-300 rounded peer-checked:bg-green-600 peer-checked:border-green-600 transition flex items-center justify-center">
                            <span className="text-white text-xs font-bold opacity-0 peer-checked:opacity-100">✓</span>
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-stone-900 text-sm group-hover:text-green-700 transition">{lang === 'en' ? 'News & Events (Newsletter)' : 'Novinky a akce (Newsletter)'}</p>
                          <p className="text-xs text-stone-500">{lang === 'en' ? 'Stay updated with our latest news and upcoming events.' : 'Dostávejte informace o novinkách a nadcházejících akcích spolku.'}</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">
                      {dict.member.addressLabel}
                    </label>
                    <AddressAutocomplete
                      lang={lang}
                      value={editProfile.address}
                      onChange={(v) => setEditProfile({ ...editProfile, address: v })}
                      onSelect={(it) => setEditAddressMeta(it)}
                      placeholder={dict.member.addressPlaceholder}
                      inputClassName="w-full bg-stone-50 border-stone-100 border rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                    />
                  </div>

                  <AvatarUploader
                    lang={lang}
                    userId={user.id}
                    currentUrl={profile?.avatar_url}
                    onUploaded={(url: string) => setProfile({ ...profile, avatar_url: url })}
                  />
                  <button type="submit" disabled={isSavingProfile} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl hover:bg-green-700 transition shadow-lg shadow-green-600/20 disabled:opacity-50">
                    {isSavingProfile ? (dict.member.saving || (lang === 'en' ? 'Saving...' : 'Ukládám...')) : (dict.member.saveProfile || (lang === 'en' ? 'Save changes' : 'Uložit změny'))}
                  </button>
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
                        ['badges', lang === 'en' ? 'Badges' : 'Odznaky'],
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
                    {pw1 ? (
                      <div className="pt-2">
                        {(() => {
                          const r = evaluatePassword(pw1);
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
                        <div className="bg-white border border-stone-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
                          <Image src="/logo.png" alt="Pupen" width={40} height={40} className="h-10 w-10 object-contain" />
                          <Image src={mfaEnrollQr} alt="2FA QR" width={260} height={260} className="w-full max-w-[260px]" unoptimized />
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
                      {lang === 'en' ? 'Passkeys (WebAuthn)' : 'Passkeys (WebAuthn)'}
                    </div>
                    <div className="mt-2 text-sm text-stone-600 font-medium">
                      {lang === 'en'
                        ? 'Add a passkey for faster and safer sign-in.'
                        : 'Přidejte passkey pro rychlejší a bezpečnější přihlášení.'}
                    </div>

                    <div className="mt-4 space-y-3">
                      <input
                        value={passkeyFriendlyName}
                        onChange={(e) => setPasskeyFriendlyName(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                        placeholder={lang === 'en' ? 'Name (e.g., MacBook)' : 'Název (např. MacBook)'}
                      />
                      <button
                        type="button"
                        onClick={registerPasskey}
                        disabled={passkeysLoading}
                        className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {passkeysLoading ? (lang === 'en' ? 'Loading...' : 'Načítám...') : (lang === 'en' ? 'Add passkey' : 'Přidat passkey')}
                      </button>
                    </div>

                    <div className="mt-6 space-y-2">
                      {passkeyFactors.length ? (
                        passkeyFactors.map((f: any) => (
                          <div key={f.id} className="flex items-center justify-between gap-3 bg-white border border-stone-100 rounded-2xl px-4 py-3">
                            <div className="min-w-0">
                              <div className="font-bold text-stone-900 truncate">{f.friendly_name || 'Passkey'}</div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                                {String(f.status || '').toUpperCase() || '—'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePasskey(String(f.id))}
                              disabled={passkeysLoading}
                              className="shrink-0 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50"
                            >
                              {lang === 'en' ? 'Remove' : 'Odebrat'}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-stone-400 font-bold uppercase tracking-widest">
                          {lang === 'en' ? 'No passkeys yet.' : 'Zatím žádné passkeys.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {googleAuthEnabled && (
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
                  )}
                </div>
              </MemberPanel>
              {mfaDisableOpen && (
                <Dialog
                  open={mfaDisableOpen}
                  onClose={() => setMfaDisableOpen(false)}
                  overlayClassName="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                  panelClassName="w-full max-w-md bg-white rounded-[2rem] border border-stone-100 shadow-2xl p-6"
                >
                      <div className="text-sm font-black text-stone-900">{lang === 'en' ? 'Disable 2FA' : 'Vypnout 2FA'}</div>
                      <div className="mt-2 text-xs font-bold text-stone-500">
                        {lang === 'en' ? 'Enter your 6-digit code to confirm.' : 'Pro potvrzení zadejte 6místný kód z aplikace.'}
                      </div>
                      <input
                        value={mfaDisableCode}
                        onChange={(e) => setMfaDisableCode(e.target.value)}
                        inputMode="numeric"
                        className="mt-4 w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                        placeholder="123456"
                      />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setMfaDisableOpen(false)}
                          disabled={mfaLoading}
                          className="w-full py-4 bg-white text-stone-700 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
                        >
                          {lang === 'en' ? 'Cancel' : 'Zrušit'}
                        </button>
                        <button
                          type="button"
                          onClick={confirmDisableMfa}
                          disabled={mfaLoading || !String(mfaDisableCode || '').trim()}
                          className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-700 transition disabled:opacity-50"
                        >
                          {mfaLoading ? (lang === 'en' ? 'Loading...' : 'Načítám...') : (lang === 'en' ? 'Disable' : 'Vypnout')}
                        </button>
                      </div>
                </Dialog>
              )}
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
                      onClick={() => downloadGdprExport('json')}
                      className="w-full py-4 bg-white text-stone-700 rounded-2xl font-bold hover:bg-stone-50 transition border border-stone-200 flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      {ms.gdprDownload || (lang === 'en' ? 'Download JSON' : 'Stáhnout JSON')}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadGdprExport('pdf')}
                      className="w-full py-4 bg-white text-stone-700 rounded-2xl font-bold hover:bg-stone-50 transition border border-stone-200 flex items-center justify-center gap-2"
                    >
                      <FileText size={18} />
                      {lang === 'en' ? 'Download PDF' : 'Stáhnout PDF'}
                    </button>
                  </div>
                  <div className="pt-4 border-t border-stone-100">
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
