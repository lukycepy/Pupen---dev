'use client';

import React from 'react';
import { Menu } from 'lucide-react';

export default function AppShell({
  title,
  subtitle,
  sidebar,
  headerRight,
  onOpenMobileNav,
  children,
}: {
  title: string;
  subtitle?: string;
  sidebar: React.ReactNode;
  headerRight: React.ReactNode;
  onOpenMobileNav?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white dark:from-stone-950 dark:to-stone-950">
      {sidebar}
      <div className="lg:pl-[var(--app-sidebar-w)]">
        <header className="sticky top-0 z-40 border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-950/70 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {onOpenMobileNav ? (
                  <button
                    type="button"
                    onClick={onOpenMobileNav}
                    className="flex items-center justify-center w-10 h-10 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200"
                    aria-label="Otevřít navigaci"
                  >
                    <Menu size={18} />
                  </button>
                ) : null}
                <div className="min-w-0">
                  {subtitle ? (
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400 dark:text-stone-400 truncate">{subtitle}</div>
                  ) : null}
                  <h1 className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-50 tracking-tight truncate">{title}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-none py-1">{headerRight}</div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
