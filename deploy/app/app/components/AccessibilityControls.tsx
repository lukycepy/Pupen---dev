'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';

const SCALE_KEY = 'pupen_font_scale';
const THEME_KEY = 'pupen_theme';
const MOTION_KEY = 'pupen_reduce_motion';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function AccessibilityControls() {
  const pathname = usePathname();
  const [scale, setScale] = useState(1);
  const [isDark, setIsDark] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const roundedScale = useMemo(() => Math.round(scale * 100), [scale]);
  const hide = pathname?.includes('/admin') || pathname?.includes('/clen');

  useEffect(() => {
    if (hide) return;
    const storedScaleRaw = window.localStorage.getItem(SCALE_KEY);
    const storedScale = storedScaleRaw ? Number(storedScaleRaw) : 1;

    if (!Number.isNaN(storedScale)) setScale(clamp(storedScale, 0.9, 1.2));

    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }

    const storedMotion = window.localStorage.getItem(MOTION_KEY);
    if (storedMotion === '1') {
      setReduceMotion(true);
      document.documentElement.classList.add('reduce-motion');
    } else if (storedMotion == null) {
      const prefers = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefers) {
        setReduceMotion(true);
        document.documentElement.classList.add('reduce-motion');
      }
    }
  }, [hide]);

  useEffect(() => {
    if (hide) return;
    document.documentElement.style.setProperty('--font-scale', String(scale));
    window.localStorage.setItem(SCALE_KEY, String(scale));
  }, [hide, scale]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    window.localStorage.setItem(THEME_KEY, nextDark ? 'dark' : 'light');
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    window.localStorage.setItem(MOTION_KEY, next ? '1' : '0');
    if (next) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  };

  if (hide) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9998] flex items-center gap-2 bg-white/90 dark:bg-stone-900/90 backdrop-blur border border-stone-100 dark:border-stone-800 shadow-xl rounded-2xl px-3 py-2 transition-colors">
      <button
        type="button"
        onClick={() => setScale((s) => clamp(Number((s - 0.05).toFixed(2)), 0.9, 1.2))}
        className="h-9 w-9 rounded-xl bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition font-black"
        aria-label="Zmenšit písmo"
      >
        A-
      </button>
      <button
        type="button"
        onClick={() => setScale((s) => clamp(Number((s + 0.05).toFixed(2)), 0.9, 1.2))}
        className="h-9 w-9 rounded-xl bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition font-black"
        aria-label="Zvětšit písmo"
      >
        A+
      </button>
      <button
        type="button"
        onClick={() => setScale(1)}
        className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest border transition bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
        aria-label="Reset písma"
      >
        Písmo {roundedScale}%
      </button>
      
      <div className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-1"></div>
      
      <button
        type="button"
        onClick={toggleTheme}
        className="h-9 w-9 flex items-center justify-center rounded-xl bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-yellow-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition"
        aria-label="Přepnout tmavý režim"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <button
        type="button"
        onClick={toggleReduceMotion}
        className={`h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest border transition ${
          reduceMotion
            ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-600/20'
            : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
        }`}
        aria-label="Omezit animace"
      >
        RM
      </button>
    </div>
  );
}
