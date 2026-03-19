'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

const SCALE_KEY = 'pupen_font_scale';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function AccessibilityControls() {
  const pathname = usePathname();
  const [scale, setScale] = useState(1);

  const roundedScale = useMemo(() => Math.round(scale * 100), [scale]);
  const hide = pathname?.includes('/admin') || pathname?.includes('/clen');

  useEffect(() => {
    if (hide) return;
    const storedScaleRaw = window.localStorage.getItem(SCALE_KEY);
    const storedScale = storedScaleRaw ? Number(storedScaleRaw) : 1;

    if (!Number.isNaN(storedScale)) setScale(clamp(storedScale, 0.9, 1.2));
  }, [hide]);

  useEffect(() => {
    if (hide) return;
    document.documentElement.style.setProperty('--font-scale', String(scale));
    window.localStorage.setItem(SCALE_KEY, String(scale));
  }, [hide, scale]);

  if (hide) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9998] flex items-center gap-2 bg-white/90 backdrop-blur border border-stone-100 shadow-xl rounded-2xl px-3 py-2">
      <button
        type="button"
        onClick={() => setScale((s) => clamp(Number((s - 0.05).toFixed(2)), 0.9, 1.2))}
        className="h-9 w-9 rounded-xl bg-stone-50 text-stone-700 hover:bg-stone-100 transition font-black"
        aria-label="Zmenšit písmo"
      >
        A-
      </button>
      <button
        type="button"
        onClick={() => setScale((s) => clamp(Number((s + 0.05).toFixed(2)), 0.9, 1.2))}
        className="h-9 w-9 rounded-xl bg-stone-50 text-stone-700 hover:bg-stone-100 transition font-black"
        aria-label="Zvětšit písmo"
      >
        A+
      </button>
      <button
        type="button"
        onClick={() => setScale(1)}
        className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
        aria-label="Reset písma"
      >
        Písmo {roundedScale}%
      </button>
    </div>
  );
}
