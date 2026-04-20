'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { AppTheme } from './theme';

export default function AppThemeToggle({
  theme,
  onToggle,
  labels,
}: {
  theme: AppTheme;
  onToggle: () => void;
  labels?: { light?: string; dark?: string };
}) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="h-10 w-10 rounded-2xl bg-white/80 border border-stone-200 shadow-sm flex items-center justify-center text-stone-700 hover:bg-stone-50"
      aria-label={isDark ? labels?.light || 'Light mode' : labels?.dark || 'Dark mode'}
      title={isDark ? labels?.light || 'Light mode' : labels?.dark || 'Dark mode'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

