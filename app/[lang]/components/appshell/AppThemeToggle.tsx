'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { AppTheme, ResolvedTheme } from './theme';

export interface ThemeLabels {
  light?: string;
  dark?: string;
  title?: string;
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

  const cycle: AppTheme = theme === 'dark' ? 'light' : 'dark';

  const isDark = resolvedTheme === 'dark';

  const titleLight = labels?.light || 'Světlý režim';
  const titleDark = labels?.dark || 'Tmavý režim';
  const title = labels?.title || 'Přepnout režim zobrazení';

  const currentLabel = isDark ? titleDark : titleLight;
  const nextLabel = cycle === 'dark' ? titleDark : titleLight;

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
    </button>
  );
}
