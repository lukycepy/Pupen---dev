'use client';

import { useEffect, useRef } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import {
  applyThemeToDom,
  onStorageThemeChange,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
} from './theme';

const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var v=localStorage.getItem(k);var p=(v==='dark'||v==='light')?v:'light';var r=(p==='dark')?'dark':'light';var root=document.documentElement;root.dataset.theme=r;root.dataset.themePreference=p;try{root.style.colorScheme=r;}catch(e){}if(r==='dark'){root.classList.add('dark');}else{root.classList.remove('dark');}}catch(e){}})();`;

export default function ThemeSync() {
  const lastPreferenceRef = useRef<string | null>(null);

  // Bootstrap skript se vkládá do SSR HTML mimo React strom, aby React 19
  // nehlásil "Encountered a script tag while rendering React component"
  // a zároveň nedošlo k probliknutí špatného tématu před hydratací.
  useServerInsertedHTML(() => (
    <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
  ));

  useEffect(() => {
    const syncTheme = (opts?: { transition?: boolean; force?: boolean }) => {
      const stored = readStoredTheme() || 'light';
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

    // Fallback – každých 2s zkontrolovat localStorage pro externí změny (vyladěno na minimum)
    let rafTid: any;
    const tick = () => {
      try { syncTheme({ transition: true }); } catch {}
    };
    const interval = window.setInterval(tick, 2000);

    return () => {
      offStorage?.();
      if (rafTid) window.clearTimeout(rafTid);
      window.clearInterval(interval);
    };
  }, []);

  // Zabraňuje varování "THEME_STORAGE_KEY unused"
  void THEME_STORAGE_KEY;

  return null;
}
