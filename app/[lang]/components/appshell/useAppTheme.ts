'use client';

import React from 'react';
import type { AppTheme, ResolvedTheme } from './theme';
import { applyThemeToDom, onSystemThemeChange, readStoredTheme, resolveTheme, writeStoredTheme } from './theme';

export function useAppTheme(initial?: AppTheme | null) {
  const [theme, setTheme] = React.useState<AppTheme>('system');
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>('light');

  const normalize = React.useCallback((v: any): AppTheme | null => {
    return v === 'light' || v === 'dark' || v === 'system' ? v : null;
  }, []);

  React.useEffect(() => {
    const stored = readStoredTheme();
    const next = stored || normalize(initial) || 'system';
    setTheme(next);
    applyThemeToDom(next);
    setResolvedTheme(resolveTheme(next));
  }, [initial, normalize]);

  const set = React.useCallback((next: AppTheme) => {
    setTheme(next);
    writeStoredTheme(next);
    applyThemeToDom(next);
    setResolvedTheme(resolveTheme(next));
  }, []);

  React.useEffect(() => {
    if (theme !== 'system') return;
    return onSystemThemeChange(() => {
      applyThemeToDom('system');
      setResolvedTheme(resolveTheme('system'));
    });
  }, [theme]);

  return { theme, resolvedTheme, setTheme: set, isDark: resolvedTheme === 'dark' };
}
