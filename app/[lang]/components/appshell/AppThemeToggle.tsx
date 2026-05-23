'use client';

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import Popover from '@/app/components/ui/Popover';
import type { AppTheme } from './theme';

export default function AppThemeToggle({
  theme,
  onChange,
  labels,
}: {
  theme: AppTheme;
  onChange: (next: AppTheme) => void;
  labels?: { light?: string; dark?: string; system?: string; title?: string };
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  const icon =
    theme === 'dark' ? <Sun size={16} /> : theme === 'light' ? <Moon size={16} /> : <Monitor size={16} />;
  const label =
    theme === 'dark'
      ? labels?.dark || 'Dark'
      : theme === 'light'
        ? labels?.light || 'Light'
        : labels?.system || 'System';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 rounded-2xl bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700 shadow-sm flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
        aria-label={labels?.title || 'Theme'}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="app-theme-toggle"
      >
        {icon}
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        placement="bottom-end"
        offset={10}
        zIndex={60000}
        panelClassName="w-44 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-2xl rounded-[1.25rem] p-2"
      >
        <div className="space-y-1">
          {([
            { key: 'light', label: labels?.light || 'Light' },
            { key: 'dark', label: labels?.dark || 'Dark' },
            { key: 'system', label: labels?.system || 'System' },
          ] as const).map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange(it.key);
              }}
              className={[
                'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl font-bold text-sm transition',
                theme === it.key
                  ? 'bg-green-600 text-white'
                  : 'text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800',
              ].join(' ')}
              role="menuitemradio"
              aria-checked={theme === it.key}
            >
              <span>{it.label}</span>
              <span className="text-xs font-black">{theme === it.key ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}
