'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import AppShell from '@/app/[lang]/components/appshell/AppShell';
import AppLanguageSwitch from '@/app/[lang]/components/appshell/AppLanguageSwitch';
import AppThemeToggle from '@/app/[lang]/components/appshell/AppThemeToggle';
import AppUserMenu from '@/app/[lang]/components/appshell/AppUserMenu';
import { useAppTheme } from '@/app/[lang]/components/appshell/useAppTheme';
import { supabase } from '@/lib/supabase';
import MemberSidebar from './MemberSidebar';

export default function MemberShell({
  lang,
  dict,
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
  dict: any;
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
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const initialTheme = (profile?.ui_prefs && typeof profile.ui_prefs === 'object' ? profile.ui_prefs.theme : null) as any;
  const { theme, toggleTheme } = useAppTheme(initialTheme);

  const persistTheme = async (next: 'light' | 'dark') => {
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
        dict={dict}
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
                className="h-10 w-10 rounded-2xl bg-white/80 border border-stone-200 shadow-sm flex items-center justify-center text-stone-700 hover:bg-stone-50"
                aria-label={dict?.common?.customize || (lang === 'en' ? 'Customize' : 'Upravit')}
                title={dict?.common?.customize || (lang === 'en' ? 'Customize' : 'Upravit')}
              >
                <SlidersHorizontal size={16} />
              </button>
            ) : null}
            <AppLanguageSwitch lang={lang} hash={activeTab || null} />
            <AppThemeToggle
              theme={theme}
              onToggle={async () => {
                const next = theme === 'dark' ? 'light' : 'dark';
                toggleTheme();
                await persistTheme(next);
              }}
            />
            <AppUserMenu
              profile={profile}
              onLogout={onLogout}
              labels={{
                logout: dict?.common?.logout || (lang === 'en' ? 'Log out' : 'Odhlásit se'),
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

