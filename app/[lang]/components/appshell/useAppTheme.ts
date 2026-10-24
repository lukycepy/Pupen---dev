'use client';

import React from 'react';
import type { AppTheme, ResolvedTheme } from './theme';
import {
  applyThemeToDom,
  onStorageThemeChange,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from './theme';

function normalizeTheme(v: unknown): AppTheme | null {
  if (v === 'light' || v === 'dark') return v;
  if (v === 'system') return 'light';
  return null;
}

function readInitialTheme(initial: AppTheme | null | undefined): AppTheme {
  const stored = readStoredTheme();
  return normalizeTheme(stored) ?? normalizeTheme(initial) ?? 'light';
}

export function useAppTheme(initial?: AppTheme | null) {
  const [theme, setThemeState] = React.useState<AppTheme>(() => readInitialTheme(initial));
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() =>
    resolveTheme(readInitialTheme(initial)),
  );

  const applyTheme = React.useCallback((next: AppTheme, opts?: { persist?: boolean; transition?: boolean }) => {
    setThemeState(next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyThemeToDom(next, opts);
    if (opts?.persist !== false) writeStoredTheme(next);
  }, []);

  // Při mountu synchronizovat DOM s preference (bez přechodu, zabránit FOUT po hydrataci)
  React.useEffect(() => {
    const currentStored = readStoredTheme();
    const effective = normalizeTheme(currentStored) ?? normalizeTheme(initial) ?? 'light';

    const resolved = resolveTheme(effective);

    // Použijeme DOM snapshot – pokud inline script už správně nastavil třídu, neměníme nic, jen sync state.
    const isClassDark =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const domResolved: ResolvedTheme = isClassDark ? 'dark' : 'light';

    const desiredTheme = effective;
    const desiredResolved = resolved;

    if (domResolved !== desiredResolved) {
      applyThemeToDom(desiredTheme, { transition: false });
    }
    setThemeState(desiredTheme);
    setResolvedTheme(desiredResolved);

    // Cross-tab sync (storage z jiné záložky) + vnitřní event (jiná komponenta volá setTheme)
    const offStorage = onStorageThemeChange((next) => {
      const resolvedNext = resolveTheme(next);
      setThemeState(next);
      setResolvedTheme(resolvedNext);
      applyThemeToDom(next, { transition: true });
    });

    return () => {
      offStorage?.();
    };
    // Použijeme initial jen při mountu – dále je důvěryhodnější localStorage / DOM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = React.useCallback(
    (next: AppTheme) => applyTheme(next, { persist: true, transition: true }),
    [applyTheme],
  );

  return {
    theme,
    resolvedTheme,
    setTheme: set,
    isDark: resolvedTheme === 'dark',
  };
}
