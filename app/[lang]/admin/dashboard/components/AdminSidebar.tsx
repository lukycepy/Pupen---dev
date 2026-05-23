'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck,
  LogOut,
  ChevronRight,
  X,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { buildAdminMenuGroups } from './adminMenu';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import Drawer from '@/app/components/ui/Drawer';

interface AdminSidebarProps {
  lang: string;
  dict: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userProfile: any;
  permissions: any;
  onLogout: () => void;
  hiddenTabs?: string[];
  pinnedTabs?: string[];
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  desktopCollapsed: boolean;
  onToggleDesktopCollapsed: () => void;
}

interface SidebarContentProps {
  lang: string;
  dict: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userProfile: any;
  permissions: any;
  onLogout: () => void;
  setIsMobileOpen: (val: boolean) => void;
  desktopCollapsed: boolean;
  onToggleDesktopCollapsed: () => void;
  hiddenTabs?: string[];
  pinnedTabs?: string[];
}

const SidebarContent = ({ 
  lang,
  dict,
  activeTab,
  onTabChange,
  userProfile,
  permissions,
  onLogout,
  setIsMobileOpen,
  desktopCollapsed,
  onToggleDesktopCollapsed,
  hiddenTabs,
  pinnedTabs,
}: SidebarContentProps) => {
  const t = dict.admin.sidebar;
  const hidden = new Set((hiddenTabs || []).map(String));
  const pinned = new Set((pinnedTabs || []).map(String));
  const menuGroups = buildAdminMenuGroups(dict, permissions).map((g) => ({
    ...g,
    items: g.items
      .filter((it) => !hidden.has(it.id))
      .slice()
      .sort((a, b) => {
        const ap = pinned.has(a.id) ? 1 : 0;
        const bp = pinned.has(b.id) ? 1 : 0;
        return bp - ap;
      }),
  }));
  const appsVisible = menuGroups.some((g) => g.items.some((it) => it.id === 'apps' && it.visible));
  const pendingAppsQuery = useQuery({
    queryKey: ['applications_pending_count'],
    enabled: appsVisible,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return 0;
      const res = await fetch('/api/admin/applications?pendingCount=1', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || t.errors.generic);
      return Number(json?.count || 0);
    },
  });
  const pendingAppsCount = pendingAppsQuery.data ?? 0;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem('pupen_admin_nav_groups_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    const next: Record<string, boolean> = {};
    for (const g of menuGroups) next[g.title] = true;
    return next;
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        window.localStorage.setItem('pupen_admin_nav_groups_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white/80 dark:bg-stone-950/70 backdrop-blur text-stone-800 dark:text-stone-100">
      {/* BRAND */}
      <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
        <Link href={`/${lang}`} className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-green-600 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck size={22} className="text-white" />
          </div>
          {!desktopCollapsed ? (
            <div className="min-w-0">
              <div className="text-sm font-black text-stone-900 dark:text-stone-50 leading-none truncate">Pupen</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-green-700 mt-1 truncate">
                {dict.admin.title}
              </div>
            </div>
          ) : (
            <span className="sr-only">{dict.admin.title}</span>
          )}
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleDesktopCollapsed}
            className="hidden lg:inline-flex p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-900/60 text-stone-500 dark:text-stone-400"
            aria-label={desktopCollapsed ? t.expandNav : t.collapseNav}
            title={desktopCollapsed ? t.expandNav : t.collapseNav}
          >
            {desktopCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden inline-flex p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-900/60 text-stone-500 dark:text-stone-400"
            aria-label={t.closeNav}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* USER PROFILE */}
      <div className="p-4 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 dark:bg-green-950/40 rounded-2xl flex items-center justify-center font-black text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900 shrink-0">
            {userProfile?.first_name?.charAt(0) || userProfile?.email?.charAt(0).toUpperCase()}
          </div>
          {!desktopCollapsed ? (
            <div className="min-w-0">
              <div className="text-sm font-bold text-stone-900 dark:text-stone-50 truncate">{userProfile?.first_name} {userProfile?.last_name}</div>
              <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400 truncate">{userProfile?.email}</div>
            </div>
          ) : (
            <span className="sr-only">{userProfile?.email}</span>
          )}
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-grow overflow-y-auto p-3 space-y-6">
        {pinned.size > 0 ? (
          (() => {
            const pinnedItems = menuGroups
              .flatMap((g) => g.items)
              .filter((it) => it.visible && pinned.has(it.id));
            if (!pinnedItems.length) return null;
            return (
              <div className="space-y-2">
                {!desktopCollapsed ? (
                  <div className="px-3 py-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-stone-400">
                      {dict.common.pinned}
                    </span>
                  </div>
                ) : null}
                <div className="space-y-1">
                  {pinnedItems.map((item) => (
                    <button
                      key={`pinned-${item.id}`}
                      onClick={() => {
                        onTabChange(item.id);
                        setIsMobileOpen(false);
                      }}
                      className={[
                        'relative w-full flex items-center gap-3 rounded-xl font-bold transition-all duration-200 group',
                        desktopCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5 text-sm',
                        activeTab === item.id
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-900/60 text-stone-700 dark:text-stone-200',
                      ].join(' ')}
                      aria-current={activeTab === item.id ? 'page' : undefined}
                      title={desktopCollapsed ? item.label : undefined}
                    >
                      <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-stone-400 group-hover:text-green-600'} />
                      {!desktopCollapsed ? <span className="flex-grow text-left min-w-0 truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                      {!desktopCollapsed && activeTab === item.id ? <ChevronRight size={14} className="opacity-50" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()
        ) : null}
        {menuGroups.map((group, gIdx) => {
          const visibleItems = group.items.filter((item) => item.visible);
          if (visibleItems.length === 0) return null;
          const isOpen = openGroups[group.title] !== false;

          return (
            <div key={gIdx} className="space-y-2">
              {!desktopCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-900/60 transition"
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-stone-400">{group.title}</span>
                  <ChevronDown
                    size={14}
                    className={`text-stone-400 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              ) : null}
              {isOpen && (
                <div className="space-y-1">
                  {visibleItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setIsMobileOpen(false);
                    }}
                    className={[
                      'relative w-full flex items-center gap-3 rounded-xl font-bold transition-all duration-200 group',
                      desktopCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5 text-sm',
                      activeTab === item.id
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'hover:bg-stone-50 dark:hover:bg-stone-900/60 text-stone-700 dark:text-stone-200',
                    ].join(' ')}
                    aria-current={activeTab === item.id ? 'page' : undefined}
                    title={desktopCollapsed ? item.label : undefined}
                  >
                    <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-stone-400 group-hover:text-green-600'} />
                    {!desktopCollapsed ? <span className="flex-grow text-left min-w-0 truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                    {item.id === 'apps' && pendingAppsCount > 0 ? (
                      <span className={[
                        'shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest',
                        activeTab === item.id
                          ? 'bg-white/20 text-white'
                          : 'border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                        desktopCollapsed ? 'absolute right-2 top-2' : '',
                      ].join(' ')}>
                        {pendingAppsCount}
                      </span>
                    ) : null}
                    {!desktopCollapsed && activeTab === item.id ? (
                      <ChevronRight size={14} className="opacity-50" />
                    ) : null}
                  </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="p-3 border-t border-stone-100 dark:border-stone-800 space-y-1">
        {userProfile?.is_member && (
          <Link
            href={`/${lang}/clen`}
            className={[
              'w-full flex items-center gap-3 rounded-xl font-bold transition',
              desktopCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5 text-sm',
              'text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40',
            ].join(' ')}
            title={desktopCollapsed ? dict.member.sidebarSubtitle : undefined}
          >
            <ShieldCheck size={18} />
            {!desktopCollapsed ? (
              <span>{dict.member.sidebarSubtitle}</span>
            ) : (
              <span className="sr-only">{dict.member.sidebarSubtitle}</span>
            )}
          </Link>
        )}
        <button
          onClick={onLogout}
          className={[
            'w-full flex items-center gap-3 rounded-xl font-bold transition',
            desktopCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5 text-sm',
            'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40',
          ].join(' ')}
          title={desktopCollapsed ? dict.common.logout : undefined}
        >
          <LogOut size={18} />
          {!desktopCollapsed ? (
            <span>{dict.common.logout}</span>
          ) : (
            <span className="sr-only">{dict.common.logout}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default function AdminSidebar({ 
  lang,
  dict,
  activeTab,
  onTabChange,
  userProfile,
  permissions,
  onLogout,
  hiddenTabs,
  pinnedTabs,
  mobileOpen,
  onMobileOpenChange,
  desktopCollapsed,
  onToggleDesktopCollapsed,
}: AdminSidebarProps) {
  const commonProps = {
    lang, dict, activeTab, onTabChange, userProfile, permissions, onLogout,
    setIsMobileOpen: onMobileOpenChange,
    desktopCollapsed,
    onToggleDesktopCollapsed,
    hiddenTabs,
    pinnedTabs,
  };

  return (
    <>
      {/* SIDEBAR DESKTOP */}
      <aside
        className={[
          'hidden lg:block fixed left-0 top-0 bottom-0 shrink-0 z-[10000] border-r border-stone-100 bg-white',
          'dark:border-stone-800 dark:bg-stone-950',
          desktopCollapsed ? 'w-[72px]' : 'w-[260px]',
        ].join(' ')}
      >
        <SidebarContent {...commonProps} />
      </aside>

      {/* SIDEBAR MOBILE OVERLAY */}
      {mobileOpen && (
        <Drawer
          open={mobileOpen}
          onClose={() => onMobileOpenChange(false)}
          side="left"
          lockScroll={false}
          overlayClassName="lg:hidden fixed inset-0 z-[100] flex"
          backdropClassName="absolute inset-0 bg-black/60 backdrop-blur-sm"
          panelClassName="relative w-[280px] h-full animate-in slide-in-from-left duration-300 touch-pan-y"
        >
          <SidebarContent {...commonProps} />
        </Drawer>
      )}
    </>
  );
}
