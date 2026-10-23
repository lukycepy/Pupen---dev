'use client';

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { AppTheme, ResolvedTheme } from './theme';

export interface ThemeLabels {
  light?: string;
  dark?: string;
  system?: string;
  title?: string;
  cycleTo?: string;
}

export default function AppThemeToggle({
  theme,
  resolvedTheme,
  onChange,
  labels,
}: {
  theme: AppTheme;
  resolvedTheme: ResolvedTheme;
  onChange: (next: AppTheme) => void;
  labels?: ThemeLabels;
}) {
  const [pulse, setPulse] = React.useState(false);

  const cycle: AppTheme =
    theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';

  const titleLight = labels?.light || 'Světlý režim';
  const titleDark = labels?.dark || 'Tmavý režim';
  const titleSystem = labels?.system || 'Režim systému';
  const title = labels?.title || 'Přepnout režim zobrazení';

  const currentLabel = isSystem
    ? isDark
      ? `${titleSystem} · aktivní: ${titleDark}`
      : `${titleSystem} · aktivní: ${titleLight}`
    : isDark
      ? titleDark
      : titleLight;

  const nextLabel =
    cycle === 'system'
      ? titleSystem
      : cycle === 'dark'
        ? titleDark
        : titleLight;

  const handleClick = React.useCallback(() => {
    setPulse(true);
    onChange(cycle);
    window.setTimeout(() => setPulse(false), 500);
  }, [onChange, cycle]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${title} – aktuálně: ${currentLabel}`}
      aria-pressed={isDark}
      title={`${title} (${currentLabel} → ${nextLabel})`}
      data-testid="app-theme-toggle"
      className={[
        'relative isolate inline-flex h-10 w-10 items-center justify-center rounded-2xl',
        'border shadow-sm select-none align-middle',
        'transition-[colors,transform,box-shadow,border-color,background-color] duration-200 ease-out',
        'bg-white/85 dark:bg-stone-900/85',
        'border-stone-200 dark:border-stone-700',
        'text-stone-700 dark:text-stone-200',
        'hover:bg-stone-50 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-white',
        'active:scale-95 active:shadow-inner',
        'focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-stone-950',
        pulse ? 'animate-pulse-once' : '',
      ].join(' ')}
    >
      <span className="relative block h-[18px] w-[18px]" aria-hidden="true">
        <span
          className={[
            'absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out',
            !isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 -rotate-90 pointer-events-none',
          ].join(' ')}
        >
          <Sun size={18} strokeWidth={2.25} />
        </span>
        <span
          className={[
            'absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out',
            isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 rotate-90 pointer-events-none',
          ].join(' ')}
        >
          <Moon size={18} strokeWidth={2.25} />
        </span>
      </span>
      <span
        className={[
          'pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] leading-none font-black uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500',
          'transition-opacity duration-200',
          isSystem ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-hidden="true"
      >
        <Monitor size={10} strokeWidth={2.5} />
      </span>
    </button>
  );
}
