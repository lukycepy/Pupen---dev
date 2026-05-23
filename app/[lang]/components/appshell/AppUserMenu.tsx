'use client';

import React from 'react';
import { LogOut, Settings } from 'lucide-react';
import Popover from '@/app/components/ui/Popover';

export default function AppUserMenu({
  profile,
  onOpenProfile,
  onLogout,
  labels,
}: {
  profile: any;
  onOpenProfile?: () => void;
  onLogout: () => void;
  labels?: { profile?: string; logout?: string };
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const initial = String(profile?.first_name?.[0] || profile?.email?.[0] || 'U').toUpperCase();
  const name = `${String(profile?.first_name || '').trim()} ${String(profile?.last_name || '').trim()}`.trim();
  const email = String(profile?.email || '').trim();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-10 rounded-2xl pl-2 pr-3 bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700 shadow-sm hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-3"
      >
        <span className="h-8 w-8 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-600 text-white font-black text-xs flex items-center justify-center">
          {initial}
        </span>
        <span className="hidden md:block text-left min-w-0">
          <span className="block text-[11px] font-black text-stone-900 dark:text-stone-50 truncate max-w-[180px]">{name || email || '—'}</span>
          <span className="block text-[10px] font-bold text-stone-400 dark:text-stone-400 truncate max-w-[180px]">{email || '—'}</span>
        </span>
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        placement="bottom-end"
        offset={10}
        zIndex={50000}
        panelClassName="w-64 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-2xl rounded-[2rem] p-2"
      >
        <div className="p-2">
          {onOpenProfile ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenProfile();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-stone-50 dark:hover:bg-stone-800 transition text-stone-700 dark:text-stone-200 font-bold"
            >
              <Settings size={18} className="text-stone-500 dark:text-stone-400" />
              <span>{labels?.profile || 'Profil'}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/40 transition text-red-700 dark:text-red-400 font-bold"
          >
            <LogOut size={18} className="text-red-600 dark:text-red-400" />
            <span>{labels?.logout || 'Odhlásit se'}</span>
          </button>
        </div>
      </Popover>
    </div>
  );
}
