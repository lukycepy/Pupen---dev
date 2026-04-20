'use client';

import React from 'react';
import type { AppTheme } from './theme';
import { applyThemeToDom, readStoredTheme, writeStoredTheme } from './theme';

export function useAppTheme(initial?: AppTheme | null) {
  const [theme, setTheme] = React.useState<AppTheme>('light');

  React.useEffect(() => {
    const stored = readStoredTheme();
    const next = stored || initial || 'light';
    setTheme(next);
    applyThemeToDom(next);
  }, [initial]);

  const set = React.useCallback((next: AppTheme) => {
    setTheme(next);
    writeStoredTheme(next);
    applyThemeToDom(next);
  }, []);

  const toggle = React.useCallback(() => {
    set(theme === 'dark' ? 'light' : 'dark');
  }, [set, theme]);

  return { theme, setTheme: set, toggleTheme: toggle, isDark: theme === 'dark' };
}

