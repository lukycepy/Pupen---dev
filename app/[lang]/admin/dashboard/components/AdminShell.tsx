'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import AppShell from '@/app/[lang]/components/appshell/AppShell';
import AppLanguageSwitch from '@/app/[lang]/components/appshell/AppLanguageSwitch';
import AppThemeToggle from '@/app/[lang]/components/appshell/AppThemeToggle';
import AppUserMenu from '@/app/[lang]/components/appshell/AppUserMenu';
import { useAppTheme } from '@/app/[lang]/components/appshell/useAppTheme';
import { supabase } from '@/lib/supabase';

export default function AdminShell({
  lang,
  title,
  subtitle,
  userProfile,
  dict,
  permissions,
  activeTab,
  hiddenTabs,
  pinnedTabs,
  onTabChange,
  onOpenCommandPalette,
  onOpenProfile,
  onOpenTabPersonalization,
  onLogout,
  children,
}: {
  lang: string;
  title: string;
  subtitle?: string;
  userProfile: any;
  dict: any;
  permissions: any;
  activeTab: string;
  hiddenTabs?: string[];
  pinnedTabs?: string[];
  onTabChange: (tab: string) => void;
  onOpenCommandPalette: () => void;
  onOpenProfile: () => void;
  onOpenTabPersonalization?: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const storageKey = useMemo(() => 'pupen_admin_shell_desktop_collapsed_v1', []);

  const initialTheme = (userProfile?.ui_prefs && typeof userProfile.ui_prefs === 'object' ? userProfile.ui_prefs.theme : null) as any;
  const { theme, setTheme } = useAppTheme(initialTheme);

  const persistTheme = async (next: 'light' | 'dark' | 'system') => {
    const id = String(userProfile?.id || '').trim();
    if (!id) return;
    const ui = userProfile?.ui_prefs && typeof userProfile.ui_prefs === 'object' ? userProfile.ui_prefs : {};
    const nextUi = { ...ui, theme: next };
    await supabase.from('profiles').update({ ui_prefs: nextUi }).eq('id', id);
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === '1') setDesktopCollapsed(true);
    } catch {}
  }, [storageKey]);

  const toggleDesktopCollapsed = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  const sidebarWidth = desktopCollapsed ? 72 : 260;

  return (
    <div style={{ ['--app-sidebar-w' as any]: `${sidebarWidth}px` }}>
      <AdminSidebar
        lang={lang}
        dict={dict}
        activeTab={activeTab}
        onTabChange={onTabChange}
        userProfile={userProfile}
        permissions={permissions}
        onLogout={onLogout}
        hiddenTabs={hiddenTabs}
        pinnedTabs={pinnedTabs}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        desktopCollapsed={desktopCollapsed}
        onToggleDesktopCollapsed={toggleDesktopCollapsed}
      />

      <AppShell
        title={title}
        subtitle={subtitle}
        sidebar={null}
        onOpenMobileNav={() => setMobileOpen(true)}
        headerRight={
          <>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-900/80 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 font-bold shadow-sm"
            >
              <Search size={16} className="text-stone-400 dark:text-stone-400" />
              <span className="hidden sm:inline">{dict.common.search}</span>
              <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest text-stone-300 dark:text-stone-500">Ctrl K</span>
            </button>
            {onOpenTabPersonalization ? (
              <button
                type="button"
                onClick={onOpenTabPersonalization}
                className="h-10 w-10 rounded-2xl bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700 shadow-sm flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                aria-label={dict.common.customize}
                title={dict.common.customize}
              >
                <SlidersHorizontal size={16} />
              </button>
            ) : null}
            <AppLanguageSwitch lang={lang} hash={activeTab || null} />
            <AppThemeToggle
              theme={theme}
              labels={{
                title: dict.common.theme,
                light: dict.common.themeLight,
                dark: dict.common.themeDark,
                system: dict.common.themeSystem,
              }}
              onChange={async (next) => {
                setTheme(next);
                await persistTheme(next);
              }}
            />
            <AppUserMenu
              profile={userProfile}
              onOpenProfile={onOpenProfile}
              onLogout={onLogout}
              labels={{
                profile: dict.common.profile,
                logout: dict.common.logout,
              }}
            />
          </>
        }
      >
        <div className="flex items-center gap-2 text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-4">
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 hover:text-stone-700 dark:hover:text-stone-200">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900 text-green-700 dark:text-green-400">
              <ShieldCheck size={14} />
            </span>
            <span>{dict.common.web}</span>
          </Link>
          <ChevronRight size={14} className="text-stone-300 dark:text-stone-600" />
          <span className="truncate">{dict.admin.title}</span>
          <ChevronRight size={14} className="text-stone-300 dark:text-stone-600" />
          <span className="truncate text-stone-700 dark:text-stone-200">{title}</span>
        </div>
        {children}
      </AppShell>
    </div>
  );
}
