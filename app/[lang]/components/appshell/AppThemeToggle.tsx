'use client';

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
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
  const icon =
    theme === 'dark' ? <Sun size={16} /> : theme === 'light' ? <Moon size={16} /> : <Monitor size={16} />;
  const label =
    theme === 'dark'
      ? labels?.dark || 'Dark'
      : theme === 'light'
        ? labels?.light || 'Light'
        : labels?.system || 'System';

  const nextTheme: AppTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const nextLabel =
    nextTheme === 'dark'
      ? labels?.dark || 'Dark'
      : nextTheme === 'light'
        ? labels?.light || 'Light'
        : labels?.system || 'System';

  return (
    <button
      type="button"
      onClick={() => onChange(nextTheme)}
      className="h-10 w-10 rounded-2xl bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700 shadow-sm flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
      aria-label={labels?.title || 'Theme'}
      title={`${label} → ${nextLabel}`}
      data-testid="app-theme-toggle"
    >
      {icon}
    </button>
  );
}
