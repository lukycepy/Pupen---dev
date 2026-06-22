'use client';

import { useEffect } from 'react';
import { applyThemeToDom, onSystemThemeChange, readStoredTheme } from './theme';

export default function ThemeSync() {
  useEffect(() => {
    const syncTheme = () => {
      applyThemeToDom(readStoredTheme() || 'system');
    };

    syncTheme();

    return onSystemThemeChange(() => {
      if ((readStoredTheme() || 'system') === 'system') {
        syncTheme();
      }
    });
  }, []);

  return null;
}
