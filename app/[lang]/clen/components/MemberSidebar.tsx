'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  LayoutDashboard, FileText, Calendar, Users, BookOpen, 
  Settings, LogOut, ShieldCheck, ChevronRight, X, 
  Mail, Bell, QrCode, Ticket, FolderKanban, BarChart3, ScrollText, ChevronDown, Award
} from 'lucide-react';
import Drawer from '@/app/components/ui/Drawer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface MemberSidebarProps {
  lang: string;
  dict: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userProfile: any;
  onLogout: () => void;
  hiddenTabs?: string[];
  pinnedTabs?: string[];
  mobileOpen?: boolean;
  onMobileOpenChange?: (val: boolean) => void;
}

interface SidebarContentProps {
  lang: string;
  dict: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userProfile: any;
  onLogout: () => void;
  setIsMobileOpen: (val: boolean) => void;
  hiddenTabs?: string[];
  pinnedTabs?: string[];
}

const SidebarContent = ({ 
  lang, dict, activeTab, onTabChange, userProfile, onLogout, setIsMobileOpen, hiddenTabs, pinnedTabs
}: SidebarContentProps) => {
  const hidden = new Set((hiddenTabs || []).map(String));
  const pinned = new Set((pinnedTabs || []).map(String));
  const unreadDmQuery = useQuery({
    queryKey: ['dm_unread_count'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return 0;
      const res = await fetch('/api/dm/threads', { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      return Number(j?.totalUnread || 0);
    },
    refetchInterval: 10_000,
  });
  const unreadDm = Number(unreadDmQuery.data || 0);
  const menuGroups = [
    {
      title: dict.member?.navOverview || (lang === 'en' ? 'Overview' : 'Přehled'),
      items: [
        { id: 'dashboard', label: dict.member?.tabDashboard || 'Nástěnka', icon: LayoutDashboard },
        { id: 'notifications', label: dict.member?.tabNotifications || 'Notifikace', icon: Bell },
      ],
    },
    {
      title: dict.member?.navContentBenefits || (lang === 'en' ? 'Content & benefits' : 'Obsah a výhody'),
      items: [
        { id: 'events', label: dict.member?.tabEvents || 'Akce pro členy', icon: Calendar },
        { id: 'my_events', label: dict.member?.tabMyEvents || 'Moje akce', icon: Ticket },
        { id: 'documents', label: dict.member?.tabDocuments || 'Dokumenty', icon: FileText },
        { id: 'card', label: dict.member?.tabCard || 'Členská karta', icon: QrCode },
        { id: 'guidelines', label: dict.member?.tabGuidelines || 'Pravidla', icon: ShieldCheck },
        { id: 'articles', label: dict.member?.tabArticles || 'Moje články', icon: BookOpen },
        { id: 'release_notes', label: (dict.member as any)?.tabReleaseNotes || 'Release notes', icon: ScrollText },
      ],
    },
    {
      title: dict.member?.navCommunity || (lang === 'en' ? 'Community' : 'Komunita'),
      items: [
        { id: 'messages', label: dict.member?.tabMessages || 'Zprávy', icon: Mail },
        { id: 'directory', label: dict.member?.tabDirectory || 'Adresář členů', icon: Users },
        { id: 'projects', label: dict.member?.tabProjects || 'Projekty', icon: FolderKanban },
        { id: 'polls', label: dict.member?.tabPolls || 'Ankety', icon: BarChart3 },
        { id: 'badges', label: (dict.member as any)?.tabBadges || (lang === 'en' ? 'Badges' : 'Odznaky'), icon: Award },
        { id: 'governance', label: dict.member?.tabGovernance || 'Governance', icon: ScrollText },
        { id: 'board', label: dict.member?.tabBoard || 'Vedení', icon: Users },
      ],
    },
    {
      title: dict.member?.navProfile || (lang === 'en' ? 'Profile' : 'Profil'),
      items: [{ id: 'settings', label: dict.member?.tabSettings || 'Můj profil', icon: Settings }],
    },
  ];
  const filteredGroups = menuGroups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((it) => !hidden.has(it.id))
        .slice()
        .sort((a, b) => {
          const ap = pinned.has(a.id) ? 1 : 0;
          const bp = pinned.has(b.id) ? 1 : 0;
          return bp - ap;
        }),
    }))
    .filter((g) => g.items.length > 0);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem('pupen_member_nav_groups_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    const next: Record<string, boolean> = {};
    for (const g of filteredGroups) next[g.title] = true;
    return next;
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        window.localStorage.setItem('pupen_member_nav_groups_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur border-r border-stone-200">
      {/* BRAND */}
      <div className="p-6 border-b border-stone-100 flex items-center justify-between">
        <Link href={`/${lang}`} className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-600/20 shrink-0">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-stone-900 leading-none">Pupen</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mt-1">{dict.member?.sidebarSubtitle || (lang === 'en' ? 'Member area' : 'Členská sekce')}</p>
          </div>
        </Link>
        <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 hover:bg-stone-50 rounded-lg transition">
          <X size={20} className="text-stone-400" />
        </button>
      </div>

      {/* USER PROFILE BRIEF */}
      <div className="p-6 border-b border-stone-100 bg-stone-50/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-black text-green-600 border border-stone-200 shadow-sm overflow-hidden">
            {userProfile?.avatar_url ? (
              <Image src={userProfile.avatar_url} alt="Avatar" width={40} height={40} className="w-full h-full object-cover" />
            ) : (
              (userProfile?.first_name?.charAt(0) || userProfile?.email?.charAt(0).toUpperCase())
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-stone-900 truncate">{userProfile?.first_name} {userProfile?.last_name}</p>
            <p className="text-[10px] font-medium text-stone-500 truncate">{userProfile?.email}</p>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
        {pinned.size > 0 ? (
          (() => {
            const pinnedItems = filteredGroups
              .flatMap((g) => g.items)
              .filter((it) => pinned.has(it.id));
            if (!pinnedItems.length) return null;
            return (
              <div className="space-y-1">
                <div className="px-4 py-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400">
                    {dict?.common?.pinned || (lang === 'en' ? 'Pinned' : 'Připnuté')}
                  </span>
                </div>
                <div className="space-y-1">
                  {pinnedItems.map((item) => (
                    <button
                      key={`pinned-${item.id}`}
                      onClick={() => {
                        onTabChange(item.id);
                        setIsMobileOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${
                        activeTab === item.id
                          ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                          : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                      }`}
                    >
                      <item.icon
                        size={18}
                        className={activeTab === item.id ? 'text-white' : 'text-stone-400 group-hover:text-green-600'}
                      />
                      <span className="flex-grow text-left">{item.label}</span>
                      {activeTab === item.id && <ChevronRight size={14} className="opacity-50" />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()
        ) : null}
        {filteredGroups.map((group) => {
          const isOpen = openGroups[group.title] !== false;
          return (
            <div key={group.title} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between px-4 py-2 rounded-xl hover:bg-stone-50 transition"
              >
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400">{group.title}</span>
                <ChevronDown size={14} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
              </button>
              {isOpen && (
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setIsMobileOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${
                        activeTab === item.id
                          ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                          : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                      }`}
                    >
                      <item.icon
                        size={18}
                        className={activeTab === item.id ? 'text-white' : 'text-stone-400 group-hover:text-green-600'}
                      />
                      <span className="flex-grow text-left">{item.label}</span>
                      {item.id === 'messages' && unreadDm > 0 && (
                        <span
                          className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-black inline-flex items-center justify-center ${
                            activeTab === item.id ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {unreadDm > 99 ? '99+' : unreadDm}
                        </span>
                      )}
                      {activeTab === item.id && <ChevronRight size={14} className="opacity-50" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-stone-100 space-y-2">
        {userProfile?.is_admin && (
          <Link 
            href={`/${lang}/admin/dashboard`}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 transition"
          >
            <ShieldCheck size={18} className="text-stone-400" />
            <span>{dict.member?.adminPanelLink || 'Pupen Control'}</span>
          </Link>
        )}
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50/10 transition"
        >
          <LogOut size={18} />
          <span>{dict.member?.logoutShort || (lang === 'en' ? 'Log out' : 'Odhlásit se')}</span>
        </button>
      </div>
    </div>
  );
};

export default function MemberSidebar({ 
  lang,
  dict,
  activeTab,
  onTabChange,
  userProfile,
  onLogout,
  hiddenTabs,
  pinnedTabs,
  mobileOpen,
  onMobileOpenChange,
}: MemberSidebarProps) {
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const isMobileOpen = typeof mobileOpen === 'boolean' ? mobileOpen : internalMobileOpen;
  const setIsMobileOpen = onMobileOpenChange || setInternalMobileOpen;

  const commonProps = {
    lang, dict, activeTab, onTabChange, userProfile, onLogout, setIsMobileOpen, hiddenTabs, pinnedTabs
  };

  return (
    <>
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:block w-72 fixed left-0 top-0 bottom-0 shrink-0 shadow-sm z-[10000]">
        <SidebarContent {...commonProps} />
      </aside>

      {/* SIDEBAR MOBILE OVERLAY */}
      {isMobileOpen && (
        <Drawer
          open={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          side="left"
          lockScroll={false}
          overlayClassName="lg:hidden fixed inset-0 z-[100] flex"
          backdropClassName="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          panelClassName="relative w-72 h-full animate-in slide-in-from-left duration-300 shadow-2xl touch-pan-y"
        >
          <SidebarContent {...commonProps} />
        </Drawer>
      )}
    </>
  );
}
