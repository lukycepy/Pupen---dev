'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import AppShell from '@/app/[lang]/components/appshell/AppShell';
import AppLanguageSwitch from '@/app/[lang]/components/appshell/AppLanguageSwitch';
import AppThemeToggle from '@/app/[lang]/components/appshell/AppThemeToggle';
import AppUserMenu from '@/app/[lang]/components/appshell/AppUserMenu';
import ImpersonationDialog from '@/app/[lang]/components/appshell/ImpersonationDialog';
import { useAppTheme } from '@/app/[lang]/components/appshell/useAppTheme';
import type { AppTheme } from '@/app/[lang]/components/appshell/theme';
import { useDictionary } from '@/app/context/DictionaryContext';
import type { ImpersonationState } from '@/lib/impersonation-client';
import { clearImpersonationState, isImpersonatingAs, readImpersonationState } from '@/lib/impersonation-client';
import { supabase } from '@/lib/supabase';
import MemberSidebar from './MemberSidebar';

export default function MemberShell({
  lang,
  title,
  subtitle,
  activeTab,
  onTabChange,
  profile,
  onOpenProfile,
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
  onOpenProfile?: () => void;
  onLogout: () => void;
  sidebarHiddenTabs?: string[];
  sidebarPinnedTabs?: string[];
  onOpenTabPersonalization?: () => void;
  children: React.ReactNode;
}) {
  const dict = useDictionary();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [impersonationOpen, setImpersonationOpen] = React.useState(false);
  const [impersonationState, setImpersonationState] = React.useState<ImpersonationState | null>(null);
  const initialTheme = (profile?.ui_prefs && typeof profile.ui_prefs === 'object' ? profile.ui_prefs.theme : null) as any;
  const { theme, resolvedTheme, setTheme } = useAppTheme(initialTheme);
  const currentEmail = String(profile?.email || '').trim().toLowerCase();
  const canImpersonate = currentEmail === 'cepelak@pupen.org' && !!profile?.can_manage_admins;

  const persistTheme = async (next: AppTheme) => {
    const id = String(profile?.id || '').trim();
    if (!id) return;
    const ui = profile?.ui_prefs && typeof profile.ui_prefs === 'object' ? profile.ui_prefs : {};
    const nextUi = { ...ui, theme: next === 'dark' ? 'dark' : 'light' };
    await supabase.from('profiles').update({ ui_prefs: nextUi }).eq('id', id);
  };

  React.useEffect(() => {
    const state = readImpersonationState();
    if (!state) {
      setImpersonationState(null);
      return;
    }
    if (currentEmail && currentEmail === state.originalEmail) {
      clearImpersonationState();
      setImpersonationState(null);
      return;
    }
    setImpersonationState(state);
  }, [currentEmail]);

  const stopImpersonation = () => {
    const state = readImpersonationState();
    if (!state?.restoreUrl) return;
    window.location.assign(state.restoreUrl);
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
              resolvedTheme={resolvedTheme}
              labels={{
                title: dict.common.theme,
                light: dict.common.themeLight,
                dark: dict.common.themeDark,
              }}
              onChange={async (next) => {
                setTheme(next);
                await persistTheme(next);
              }}
            />
            <AppUserMenu
              profile={profile}
              onOpenProfile={onOpenProfile}
              onOpenCustomize={onOpenTabPersonalization}
              onOpenImpersonation={canImpersonate ? () => setImpersonationOpen(true) : undefined}
              onStopImpersonation={isImpersonatingAs(currentEmail, impersonationState) ? stopImpersonation : undefined}
              onLogout={onLogout}
              impersonation={isImpersonatingAs(currentEmail, impersonationState) ? impersonationState : null}
              labels={{
                profile: dict.common.profile,
                customize: dict.common.customize,
                impersonate: lang === 'cs' ? 'Přihlásit se jako' : 'Sign in as',
                stopImpersonation: lang === 'cs' ? 'Vrátit se na Váš účet' : 'Return to your account',
                impersonatingAs: lang === 'cs' ? 'Převzatá identita' : 'Impersonating',
                logout: dict.common.logout,
              }}
            />
          </>
        }
      >
        {children}
      </AppShell>
      <ImpersonationDialog
        open={impersonationOpen}
        onClose={() => setImpersonationOpen(false)}
        lang={lang === 'en' ? 'en' : 'cs'}
        currentEmail={currentEmail}
      />
    </div>
  );
}
