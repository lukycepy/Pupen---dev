'use client';

import { useEffect, useRef } from 'react';
import {
  applyThemeToDom,
  onStorageThemeChange,
  onSystemThemeChange,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
} from './theme';

export default function ThemeSync() {
  const lastPreferenceRef = useRef<string | null>(null);

  useEffect(() => {
    const syncTheme = (opts?: { transition?: boolean; force?: boolean }) => {
      const stored = readStoredTheme() || 'system';
      const key = stored + ':' + resolveTheme(stored);
      if (!opts?.force && lastPreferenceRef.current === key) return;
      lastPreferenceRef.current = key;
      applyThemeToDom(stored, { transition: opts?.transition ?? false });
    };

    // Initial sync – DOM by už měl být nastavený inline skriptem, ale sync state pro jistotu.
    try { syncTheme({ transition: false, force: true }); } catch {}

    const offStorage = onStorageThemeChange((next) => {
      try {
        const key = next + ':' + resolveTheme(next);
        lastPreferenceRef.current = key;
        applyThemeToDom(next, { transition: true });
      } catch {}
    });

    const offSystem = onSystemThemeChange(() => {
      const stored = readStoredTheme() || 'system';
      if (stored !== 'system') return;
      try { syncTheme({ transition: true, force: true }); } catch {}
    });

    // Fallback – každých 2s zkontrolovat localStorage pro externí změny (vyladěno na minimum)
    let rafTid: any;
    const tick = () => {
      try { syncTheme({ transition: true }); } catch {}
    };
    const interval = window.setInterval(tick, 2000);

    return () => {
      offStorage?.();
      offSystem?.();
      if (rafTid) window.clearTimeout(rafTid);
      window.clearInterval(interval);
    };
  }, []);

  // Zabraňuje varování "THEME_STORAGE_KEY unused"
  void THEME_STORAGE_KEY;

  return null;
}
