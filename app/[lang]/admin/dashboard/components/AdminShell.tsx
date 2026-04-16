'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Menu, Search, ChevronRight, ShieldCheck } from 'lucide-react';
import AdminSidebar from './AdminSidebar';

export default function AdminShell({
  lang,
  title,
  subtitle,
  userProfile,
  dict,
  permissions,
  activeTab,
  onTabChange,
  onOpenCommandPalette,
  onOpenProfile,
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
  onTabChange: (tab: string) => void;
  onOpenCommandPalette: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const storageKey = useMemo(() => 'pupen_admin_shell_desktop_collapsed_v1', []);

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
    <div
      className="min-h-screen bg-stone-50 admin-scope"
      style={{ ['--admin-sidebar-w' as any]: `${sidebarWidth}px` }}
    >
      <AdminSidebar
        lang={lang}
        dict={dict}
        activeTab={activeTab}
        onTabChange={onTabChange}
        userProfile={userProfile}
        permissions={permissions}
        onLogout={onLogout}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        desktopCollapsed={desktopCollapsed}
        onToggleDesktopCollapsed={toggleDesktopCollapsed}
      />

      <div className="lg:pl-[var(--admin-sidebar-w)]">
        <header
          className="sticky top-0 z-40 border-b border-stone-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
        >
          <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700"
                  aria-label="Otevřít navigaci"
                >
                  <Menu size={18} />
                </button>
                <div className="min-w-0">
                  {subtitle ? (
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400 truncate">
                      {subtitle}
                    </div>
                  ) : null}
                  <h1 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight truncate">{title}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-bold"
                >
                  <Search size={16} className="text-stone-400" />
                  <span className="hidden sm:inline">Hledat</span>
                  <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest text-stone-300">Ctrl K</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="inline-flex items-center gap-3 px-3 py-2 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50"
                  aria-label="Otevřít profil"
                >
                  <div className="w-8 h-8 bg-green-50 rounded-2xl flex items-center justify-center text-green-700 font-black text-xs border border-green-100">
                    {userProfile?.first_name?.charAt(0) || userProfile?.email?.charAt(0)?.toUpperCase()}
                  </div>
                  <span className="hidden lg:inline text-sm font-bold text-stone-700 truncate max-w-[220px]">
                    {userProfile?.first_name} {userProfile?.last_name}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-2 text-[11px] font-medium text-stone-500 mb-4">
            <Link href={`/${lang}`} className="inline-flex items-center gap-2 hover:text-stone-700">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-xl bg-green-50 border border-green-100 text-green-700">
                <ShieldCheck size={14} />
              </span>
              <span>Web</span>
            </Link>
            <ChevronRight size={14} className="text-stone-300" />
            <span className="truncate">Administrace</span>
            <ChevronRight size={14} className="text-stone-300" />
            <span className="truncate text-stone-700">{title}</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
