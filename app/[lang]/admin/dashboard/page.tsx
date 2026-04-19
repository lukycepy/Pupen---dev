'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/get-dictionary';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, X, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import tabs for optimization with proper props typing
const EventsTab = dynamic<any>(() => import('./components/EventsTab'), { loading: () => <SkeletonTabContent /> });
const NewsTab = dynamic<any>(() => import('./components/NewsTab'), { loading: () => <SkeletonTabContent /> });
const UsersTab = dynamic<any>(() => import('./components/UsersTab'), { loading: () => <SkeletonTabContent /> });
const RolesTab = dynamic<any>(() => import('./components/RolesTab'), { loading: () => <SkeletonTabContent /> });
const MessagesTab = dynamic<any>(() => import('./components/MessagesTab'), { loading: () => <SkeletonTabContent /> });
const FAQTab = dynamic<any>(() => import('./components/FAQTab'), { loading: () => <SkeletonTabContent /> });
const PartnersTab = dynamic<any>(() => import('./components/PartnersTab'), { loading: () => <SkeletonTabContent /> });
const ApplicationsTab = dynamic<any>(() => import('./components/ApplicationsTab'), { loading: () => <SkeletonTabContent /> });
const BannersTab = dynamic<any>(() => import('./components/BannersTab'), { loading: () => <SkeletonTabContent /> });
const LogsTab = dynamic<any>(() => import('./components/LogsTab'), { loading: () => <SkeletonTabContent /> });
const AnalyticsTab = dynamic<any>(() => import('./components/AnalyticsTab'), { loading: () => <SkeletonTabContent /> });
const BlogTab = dynamic<any>(() => import('./components/BlogTab'), { loading: () => <SkeletonTabContent /> });
const ReviewsTab = dynamic<any>(() => import('./components/ReviewsTab'), { loading: () => <SkeletonTabContent /> });
const AssetsTab = dynamic<any>(() => import('./components/AssetsTab'), { loading: () => <SkeletonTabContent /> });
const BudgetTab = dynamic<any>(() => import('./components/BudgetTab'), { loading: () => <SkeletonTabContent /> });
const MeetingsTab = dynamic<any>(() => import('./components/MeetingsTab'), { loading: () => <SkeletonTabContent /> });
const GovernanceTab = dynamic<any>(() => import('./components/GovernanceTab'), { loading: () => <SkeletonTabContent /> });
const DocumentsTab = dynamic<any>(() => import('./components/DocumentsTab'), { loading: () => <SkeletonTabContent /> });
const QuizzesTab = dynamic<any>(() => import('./components/QuizzesTab'), { loading: () => <SkeletonTabContent /> });
const PollsTab = dynamic<any>(() => import('./components/PollsTab'), { loading: () => <SkeletonTabContent /> });
const JobsTab = dynamic<any>(() => import('./components/JobsTab'), { loading: () => <SkeletonTabContent /> });
const ScheduleTab = dynamic<any>(() => import('./components/ScheduleTab'), { loading: () => <SkeletonTabContent /> });
const GuideTab = dynamic<any>(() => import('./components/GuideTab'), { loading: () => <SkeletonTabContent /> });
const OpeningHoursTab = dynamic<any>(() => import('./components/OpeningHoursTab'), { loading: () => <SkeletonTabContent /> });
const FeedbackTab = dynamic<any>(() => import('./components/FeedbackTab'), { loading: () => <SkeletonTabContent /> });
const HuntsTab = dynamic<any>(() => import('./components/HuntsTab'), { loading: () => <SkeletonTabContent /> });
const DiscountsTab = dynamic<any>(() => import('./components/DiscountsTab'), { loading: () => <SkeletonTabContent /> });
const QRTab = dynamic<any>(() => import('./components/QRTab'), { loading: () => <SkeletonTabContent /> });
const TicketsTab = dynamic<any>(() => import('./components/TicketsTab'), { loading: () => <SkeletonTabContent /> });
const GalleryTab = dynamic<any>(() => import('./components/GalleryTab'), { loading: () => <SkeletonTabContent /> });
const BooksTab = dynamic<any>(() => import('./components/BooksTab'), { loading: () => <SkeletonTabContent /> });
const ArchiveTab = dynamic<any>(() => import('./components/ArchiveTab'), { loading: () => <SkeletonTabContent /> });
const MapTab = dynamic<any>(() => import('./components/MapTab'), { loading: () => <SkeletonTabContent /> });
const EmailSettingsTab = dynamic<any>(() => import('./components/EmailSettingsTab'), { loading: () => <SkeletonTabContent /> });
const EmailTemplatesTab = dynamic<any>(() => import('./components/EmailTemplatesTab'), { loading: () => <SkeletonTabContent /> });
const PaymentSettingsTab = dynamic<any>(() => import('./components/PaymentSettingsTab'), { loading: () => <SkeletonTabContent /> });
const NewsletterTab = dynamic<any>(() => import('./components/NewsletterTab'), { loading: () => <SkeletonTabContent /> });
const QueueTab = dynamic<any>(() => import('./components/QueueTab'), { loading: () => <SkeletonTabContent /> });
const ContentLibraryTab = dynamic<any>(() => import('./components/ContentLibraryTab'), { loading: () => <SkeletonTabContent /> });
const InvoicesTab = dynamic<any>(() => import('./components/InvoicesTab'), { loading: () => <SkeletonTabContent /> });
const OgPreviewTab = dynamic<any>(() => import('./components/OgPreviewTab'), { loading: () => <SkeletonTabContent /> });
const ModerationTab = dynamic<any>(() => import('./components/ModerationTab'), { loading: () => <SkeletonTabContent /> });
const ProjectsTab = dynamic<any>(() => import('./components/ProjectsTab'), { loading: () => <SkeletonTabContent /> });
const BoardTab = dynamic<any>(() => import('./components/BoardTab'), { loading: () => <SkeletonTabContent /> });
const AutomationTab = dynamic<any>(() => import('./components/AutomationTab'), { loading: () => <SkeletonTabContent /> });
const RefundsTab = dynamic<any>(() => import('./components/RefundsTab'), { loading: () => <SkeletonTabContent /> });
const TicketSecurityTab = dynamic<any>(() => import('./components/TicketSecurityTab'), { loading: () => <SkeletonTabContent /> });
const PromoRulesTab = dynamic<any>(() => import('./components/PromoRulesTab'), { loading: () => <SkeletonTabContent /> });
const SiteConfigTab = dynamic<any>(() => import('./components/SiteConfigTab'), { loading: () => <SkeletonTabContent /> });
const DbHealthTab = dynamic<any>(() => import('./components/DbHealthTab'), { loading: () => <SkeletonTabContent /> });
const LostFoundTab = dynamic<any>(() => import('./components/LostFoundTab'), { loading: () => <SkeletonTabContent /> });
const SosTab = dynamic<any>(() => import('./components/SosTab'), { loading: () => <SkeletonTabContent /> });
const BrokenLinksTab = dynamic<any>(() => import('./components/BrokenLinksTab'), { loading: () => <SkeletonTabContent /> });
const GodModeTab = dynamic<any>(() => import('./components/GodModeTab'), { loading: () => <SkeletonTabContent /> });
const BadgesTab = dynamic<any>(() => import('./components/BadgesTab'), { loading: () => <SkeletonTabContent /> });
const ErrorLogsTab = dynamic<any>(() => import('./components/ErrorLogsTab'), { loading: () => <SkeletonTabContent /> });
const WebhooksTab = dynamic<any>(() => import('./components/WebhooksTab'), { loading: () => <SkeletonTabContent /> });
const TrustBoxTab = dynamic<any>(() => import('./components/TrustBoxTab'), { loading: () => <SkeletonTabContent /> });


import { useToast } from '@/app/context/ToastContext';
import Skeleton, { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';

import AdminCommandPalette from './components/AdminCommandPalette';
import { buildAdminMenuGroups } from './components/adminMenu';
import Dialog from '@/app/components/ui/Dialog';
import AdminShell from './components/AdminShell';

export default function AdminDashboard() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const router = useRouter();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editProfile, setEditProfile] = useState({ first_name: '', last_name: '' });

  const [dict, setDict] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>({
    can_manage_admins: false,
    trustbox_admin: false,
    trustbox_can_view_pii: false,
  });

  const tabLabels = useMemo(() => {
    if (!dict) return new Map<string, string>();
    const groups = buildAdminMenuGroups(dict, permissions);
    const map = new Map<string, string>();
    for (const g of groups) {
      for (const it of g.items) {
        map.set(it.id, it.label);
      }
    }
    map.set('content', dict.admin?.tabContent || 'Knihovna obsahu');
    return map;
  }, [dict, permissions]);

  const activeTitle = tabLabels.get(String(activeTab)) || (activeTab ? String(activeTab).replaceAll('_', ' ') : 'Pupen Control');

  // Handle URL hash for tab persistence
  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) setActiveTab(hash);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (!dict) return;
    const groups = buildAdminMenuGroups(dict, permissions);
    const visible = groups.flatMap((g) => g.items).filter((it) => it.visible);
    const visibleIds = new Set(visible.map((it) => it.id));
    const preferred = visibleIds.has('content') ? 'content' : visible[0]?.id;

    const hash = window.location.hash.replace('#', '');
    if (hash && visibleIds.has(hash)) {
      if (activeTab !== hash) setActiveTab(hash);
      return;
    }

    if (!activeTab) {
      setActiveTab(preferred || 'content');
      return;
    }

    if (!visibleIds.has(activeTab) && preferred) {
      setActiveTab(preferred);
    }
  }, [activeTab, dict, permissions]);

  useEffect(() => {
    if (userProfile) {
      setEditProfile({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || ''
      });
    }
  }, [userProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editProfile.first_name,
          last_name: editProfile.last_name
        })
        .eq('id', currentUser.id);

      if (error) throw error;
      
      showToast(lang === 'cs' ? 'Profil byl aktualizován' : 'Profile updated', 'success');
      setIsProfileOpen(false);
      // Refresh session or profile data if needed
      window.location.reload(); 
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    try {
      window.history.replaceState(null, '', `#${tab}`);
    } catch {
      window.location.hash = tab;
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Helper to check permissions
  const canView = (module: string) => permissions.can_manage_admins || permissions[`can_view_${module}`] || permissions[`can_edit_${module}`];
  const canEdit = (module: string) => permissions.can_manage_admins || permissions[`can_edit_${module}`];
  const canViewContent = canView('news') || canView('events') || canView('faq');
  const canViewFinance = canView('budget') || permissions.can_manage_admins;

  // Fetch dictionary
  useEffect(() => {
    getDictionary(lang).then(setDict);
  }, [lang]);

  // Auth and Permissions
  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (isMounted) router.replace(`/${lang}/admin`);
        return;
      }
      
      const user = session.user;
      if (!isMounted) return;
      setCurrentUser(user);

      // Fetch profile
      let profile: any = null;
      try {
        const token = session.access_token;
        const profRes = await fetch('/api/auth/me-profile', { headers: { Authorization: `Bearer ${token}` } });
        const profJson = await profRes.json().catch(() => ({}));
        profile = profRes.ok ? (profJson?.profile || null) : null;
      } catch {
        profile = null;
      }
      
      if (!profile && isMounted) {
        router.replace(`/${lang}/admin`);
        return;
      }

      if (profile && isMounted) {
        // CHECK IF IS ADMIN
        if (!profile.is_admin && !profile.can_manage_admins) {
          // If not admin but member, redirect to member portal
          if (profile.is_member) {
            router.replace(`/${lang}/clen`);
          } else {
            router.replace(`/${lang}/admin`);
          }
          return;
        }

        if ((profile.is_admin || profile.can_manage_admins) && !profile.can_manage_admins) {
          try {
            const authAny: any = supabase.auth as any;
            const aal = await authAny?.mfa?.getAuthenticatorAssuranceLevel?.();
            const current = String(aal?.data?.currentLevel || aal?.data?.current_level || '');
            if (current && current !== 'aal2') {
              router.replace(`/${lang}/login`);
              return;
            }
          } catch {}
        }

        setUserProfile(profile);
        
        const finalPerms: any = { ...profile, trustbox_admin: false, trustbox_can_view_pii: false };
        setPermissions(finalPerms);

        try {
          const token = session.access_token;
          if (token) {
            const res = await fetch('/api/admin/trustbox/me', { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json().catch(() => ({}));
            if (res.ok && isMounted) {
              setPermissions((prev: any) => ({
                ...prev,
                trustbox_admin: true,
                trustbox_can_view_pii: !!json?.canViewPii,
              }));
            }
          }
        } catch {}

        // Find first available tab - ONLY if no hash exists
        if (!window.location.hash) {
          setActiveTab('analytics');
        }
      }
    };
    checkAuth();
    return () => { isMounted = false; };
  }, [router, lang]);

  // TanStack Queries
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    enabled: ['events', 'tickets', 'gallery', 'promo_rules'].includes(String(activeTab)),
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').order('date', { ascending: true }).limit(500);
      return data || [];
    }
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['posts'],
    enabled: String(activeTab) === 'gallery',
    queryFn: async () => {
      const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(500);
      return data || [];
    }
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace(`/${lang}/admin`);
  };

  const uploadImage = async (file: File, bucket: string, pathPrefix = '') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}.${fileExt}`;
    const prefix = String(pathPrefix || '').replace(/^\/+/, '').replace(/\/+$/, '');
    const filePath = prefix ? `${prefix}/${fileName}` : `${fileName}`;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Unauthorized');

    const doUpload = async (bucketName: string, path: string) => {
      const form = new FormData();
      form.set('bucket', bucketName);
      form.set('path', path);
      form.set('file', file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      return String(json?.publicUrl || '');
    };

    try {
      return await doUpload(bucket, filePath);
    } catch {
      if (bucket !== 'images') {
        return await doUpload('images', `fallback/${bucket}/${filePath}`);
      }
      throw new Error('Upload failed');
    }
  };

  if (!dict || !currentUser)
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="sticky top-0 z-40 border-b border-stone-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400 truncate">Administrace</div>
                <Skeleton className="h-7 w-40 rounded-xl" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-28 rounded-2xl" />
                <Skeleton className="h-10 w-10 rounded-2xl" />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-72 rounded-2xl" />
            <SkeletonTabContent />
          </div>
        </main>
      </div>
    );

  return (
    <>
      <AdminCommandPalette
        open={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onSelectTab={(tab) => {
          handleTabChange(tab);
          setIsPaletteOpen(false);
        }}
        dict={dict}
        permissions={permissions}
      />

      <AdminShell
        lang={lang}
        title={activeTitle}
        subtitle="Administrace"
        userProfile={userProfile}
        dict={dict}
        permissions={permissions}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenCommandPalette={() => setIsPaletteOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
      >
        {isProfileOpen && (
          <Dialog
            open={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            overlayClassName="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-300 text-left"
            panelClassName="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-stone-900">{lang === 'cs' ? 'Nastavení profilu' : 'Profile Settings'}</h2>
              <button onClick={() => setIsProfileOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition text-stone-400">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{lang === 'cs' ? 'Jméno' : 'First Name'}</label>
                <input
                  type="text"
                  required
                  value={editProfile.first_name}
                  onChange={(e) => setEditProfile({ ...editProfile, first_name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{lang === 'cs' ? 'Příjmení' : 'Last Name'}</label>
                <input
                  type="text"
                  required
                  value={editProfile.last_name}
                  onChange={(e) => setEditProfile({ ...editProfile, last_name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{lang === 'cs' ? 'E-mail (nelze měnit)' : 'Email (cannot change)'}</label>
                <input
                  type="email"
                  disabled
                  value={currentUser?.email || ''}
                  className="w-full bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-400 cursor-not-allowed outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition"
                >
                  {lang === 'cs' ? 'Zrušit' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                >
                  {isSavingProfile ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                  {lang === 'cs' ? 'Uložit změny' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Dialog>
        )}

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'analytics' && canView('logs') && (
              <AnalyticsTab />
            )}

            {activeTab === 'content' && canViewContent && (
              <ContentLibraryTab
                events={events}
                posts={posts}
                onGoToTab={(tab: string) => handleTabChange(tab)}
              />
            )}

            {activeTab === 'events' && canView('events') && (
              <EventsTab dict={dict} events={events} uploadImage={uploadImage} currentUser={currentUser} userProfile={userProfile} readOnly={!canEdit('events')} />
            )}
            
            {activeTab === 'blog' && canView('news') && (
              <NewsTab dict={dict} uploadImage={uploadImage} currentUser={currentUser} userProfile={userProfile} readOnly={!canEdit('news')} />
            )}

            {activeTab === 'messages' && canView('messages') && (
              <MessagesTab dict={dict} readOnly={!canEdit('messages')} />
            )}

            {activeTab === 'trustbox' && (permissions.can_manage_admins || permissions.trustbox_admin) && (
              <TrustBoxTab dict={dict} />
            )}

            {activeTab === 'users' && permissions.can_manage_admins && (
              <UsersTab dict={dict} />
            )}

            {activeTab === 'roles' && permissions.can_manage_admins && (
              <RolesTab dict={dict} />
            )}

            {activeTab === 'site_pages' && permissions.can_manage_admins && (
              <SiteConfigTab dict={dict} />
            )}

            {activeTab === 'db_health' && permissions.can_manage_admins && (
              <DbHealthTab />
            )}

            {activeTab === 'lost_found' && permissions.can_manage_admins && (
              <LostFoundTab dict={dict} />
            )}

            {activeTab === 'sos' && permissions.can_manage_admins && (
              <SosTab />
            )}

            {activeTab === 'broken_links' && permissions.can_manage_admins && (
              <BrokenLinksTab />
            )}

            {activeTab === 'webhooks' && permissions.can_manage_admins && (
              <WebhooksTab />
            )}

            {activeTab === 'error_logs' && permissions.can_manage_admins && (
              <ErrorLogsTab />
            )}

            {activeTab === 'god_mode' && permissions.can_manage_admins && (
              <GodModeTab />
            )}

            {activeTab === 'badges' && permissions.can_manage_admins && (
              <BadgesTab uploadImage={uploadImage} />
            )}



            {activeTab === 'faq' && canView('faq') && (
              <FAQTab dict={dict} readOnly={!canEdit('faq')} />
            )}

            {activeTab === 'partners' && canView('partners') && (
              <PartnersTab dict={dict} uploadImage={uploadImage} readOnly={!canEdit('partners')} />
            )}

            {activeTab === 'apps' && canView('apps') && (
              <ApplicationsTab dict={dict} readOnly={!canEdit('apps')} />
            )}

            {activeTab === 'blog_mod' && canView('blog_mod') && (
              <BlogTab dict={dict} readOnly={!canEdit('blog_mod')} />
            )}

            {activeTab === 'reviews' && canView('reviews') && (
              <ReviewsTab dict={dict} readOnly={!canEdit('reviews')} />
            )}

            {activeTab === 'assets' && canView('assets') && (
              <AssetsTab dict={dict} readOnly={!canEdit('assets')} />
            )}

            {activeTab === 'budget' && canView('budget') && (
              <BudgetTab dict={dict} uploadImage={uploadImage} />
            )}

            {activeTab === 'invoices' && canViewFinance && (
              <InvoicesTab />
            )}

            {activeTab === 'refunds' && canView('refunds') && (
              <RefundsTab dict={dict} />
            )}

            {activeTab === 'ticket_security' && canView('ticket_security') && (
              <TicketSecurityTab dict={dict} />
            )}

            {activeTab === 'promo_rules' && canView('events') && (
              <PromoRulesTab dict={dict} />
            )}

            {activeTab === 'moderation' && canView('moderation') && (
              <ModerationTab currentUser={currentUser} userProfile={userProfile} />
            )}

            {activeTab === 'projects' && canView('projects') && (
              <ProjectsTab currentUser={currentUser} userProfile={userProfile} />
            )}

            {activeTab === 'meetings' && canView('meetings') && (
              <MeetingsTab dict={dict} readOnly={!canEdit('meetings')} />
            )}

            {activeTab === 'governance' && canView('meetings') && (
              <GovernanceTab dict={dict} />
            )}

            {activeTab === 'board' && permissions.can_manage_admins && (
              <BoardTab uploadImage={uploadImage} />
            )}

            {activeTab === 'documents' && canView('documents') && (
              <DocumentsTab dict={dict} uploadFile={uploadImage} readOnly={!canEdit('documents')} />
            )}

            {activeTab === 'quizzes' && canView('quizzes') && (
              <QuizzesTab dict={dict} readOnly={!canEdit('quizzes')} />
            )}

            {activeTab === 'polls' && canView('polls') && (
              <PollsTab dict={dict} />
            )}

            {activeTab === 'jobs' && canView('jobs') && (
               <JobsTab dict={dict} readOnly={!canEdit('jobs')} />
             )}
   
            {activeTab === 'schedule' && canView('schedule') && (
              <ScheduleTab dict={dict} readOnly={!canEdit('schedule')} />
            )}

            {activeTab === 'guide' && canView('guide') && (
              <GuideTab dict={dict} readOnly={!canEdit('guide')} />
            )}

            {activeTab === 'hours' && canView('hours') && (
              <OpeningHoursTab dict={dict} readOnly={!canEdit('hours')} />
            )}

            {activeTab === 'discounts' && canView('discounts') && (
              <DiscountsTab dict={dict} readOnly={!canEdit('discounts')} />
            )}

            {activeTab === 'hunts' && canView('hunts') && (
              <HuntsTab dict={dict} readOnly={!canEdit('hunts')} />
            )}

            {activeTab === 'feedback' && canView('feedback') && (
              <FeedbackTab dict={dict} readOnly={!canEdit('feedback')} />
            )}
             {activeTab === 'banners' && canView('banners') && (
              <BannersTab dict={dict} />
             )}

            {activeTab === 'logs' && canView('logs') && (
              <LogsTab readOnly={!canEdit('logs')} />
            )}

            {activeTab === 'newsletter' && canView('newsletter') && (
              <NewsletterTab />
            )}

            {activeTab === 'queue' && permissions.can_manage_admins && (
              <QueueTab dict={dict} />
            )}

            {activeTab === 'email_settings' && canView('email_settings') && (
              <EmailSettingsTab dict={dict} />
            )}

            {activeTab === 'email_templates' && canView('email_settings') && (
              <EmailTemplatesTab />
            )}

            {activeTab === 'automation' && canView('email_settings') && (
              <AutomationTab dict={dict} />
            )}

            {activeTab === 'payment_settings' && permissions.can_manage_admins && (
              <PaymentSettingsTab dict={dict} />
            )}

            {activeTab === 'qr' && canView('qr') && (
              <QRTab dict={dict} readOnly={!canEdit('qr')} />
            )}

            {activeTab === 'tickets' && canView('events') && (
              <TicketsTab />
            )}

            {activeTab === 'gallery' && canView('gallery') && (
              <GalleryTab dict={dict} uploadImage={uploadImage} readOnly={!canEdit('gallery')} currentUser={currentUser} events={events} posts={posts} />
            )}

            {activeTab === 'og_preview' && canView('og_preview') && (
              <OgPreviewTab />
            )}

            {activeTab === 'books' && canView('books') && (
              <BooksTab dict={dict} readOnly={!canEdit('books')} />
            )}

            {activeTab === 'archive' && canView('archive') && (
              <ArchiveTab dict={dict} />
            )}

            {activeTab === 'map' && canView('map') && (
              <MapTab dict={dict} readOnly={!canEdit('map')} />
            )}
        </div>
      </AdminShell>
    </>
  );
}
