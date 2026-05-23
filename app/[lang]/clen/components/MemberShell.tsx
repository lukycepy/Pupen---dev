'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import AppShell from '@/app/[lang]/components/appshell/AppShell';
import AppLanguageSwitch from '@/app/[lang]/components/appshell/AppLanguageSwitch';
import AppThemeToggle from '@/app/[lang]/components/appshell/AppThemeToggle';
import AppUserMenu from '@/app/[lang]/components/appshell/AppUserMenu';
import { useAppTheme } from '@/app/[lang]/components/appshell/useAppTheme';
import { useDictionary } from '@/app/context/DictionaryContext';
import { supabase } from '@/lib/supabase';
import MemberSidebar from './MemberSidebar';

export default function MemberShell({
  lang,
  title,
  subtitle,
  activeTab,
  onTabChange,
  profile,
  onLogout,
  sidebarHiddenTabs,
  sidebarPinnedTabs,
  onOpenTabPersonalization,
  children,
}: {
  lang: string;
  title: string;
  subtitle?: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  profile: any;
  onLogout: () => void;
  sidebarHiddenTabs?: string[];
  sidebarPinnedTabs?: string[];
  onOpenTabPersonalization?: () => void;
  children: React.ReactNode;
}) {
  const dict = useDictionary();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const initialTheme = (profile?.ui_prefs && typeof profile.ui_prefs === 'object' ? profile.ui_prefs.theme : null) as any;
  const { theme, setTheme } = useAppTheme(initialTheme);

  const persistTheme = async (next: 'light' | 'dark' | 'system') => {
    const id = String(profile?.id || '').trim();
    if (!id) return;
    const ui = profile?.ui_prefs && typeof profile.ui_prefs === 'object' ? profile.ui_prefs : {};
    const nextUi = { ...ui, theme: next };
    await supabase.from('profiles').update({ ui_prefs: nextUi }).eq('id', id);
  };

  return (
    <div style={{ ['--app-sidebar-w' as any]: '288px' }}>
      <MemberSidebar
        lang={lang}
        activeTab={activeTab}
        onTabChange={onTabChange}
        userProfile={profile}
        onLogout={onLogout}
        hiddenTabs={sidebarHiddenTabs}
        pinnedTabs={sidebarPinnedTabs}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      <AppShell
        title={title}
        subtitle={subtitle}
        sidebar={null}
        onOpenMobileNav={() => setMobileOpen(true)}
        headerRight={
          <>
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
              profile={profile}
              onLogout={onLogout}
              labels={{
                logout: dict.common.logout,
              }}
            />
          </>
        }
      >
        {children}
      </AppShell>
    </div>
  );
}
