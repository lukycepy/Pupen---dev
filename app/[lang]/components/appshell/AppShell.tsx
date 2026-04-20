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
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {sidebar}
      <div className="lg:pl-[var(--app-sidebar-w)]">
        <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {onOpenMobileNav ? (
                  <button
                    type="button"
                    onClick={onOpenMobileNav}
                    className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700"
                    aria-label="Otevřít navigaci"
                  >
                    <Menu size={18} />
                  </button>
                ) : null}
                <div className="min-w-0">
                  {subtitle ? (
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400 truncate">{subtitle}</div>
                  ) : null}
                  <h1 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight truncate">{title}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">{headerRight}</div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

