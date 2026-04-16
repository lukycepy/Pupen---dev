'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { usePathname } from 'next/navigation';

function getScrollProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const scrollHeight = doc.scrollHeight || 0;
  const clientHeight = doc.clientHeight || 0;
  const max = Math.max(1, scrollHeight - clientHeight);
  return Math.min(100, Math.max(0, (scrollTop / max) * 100));
}

export default function BackToTopButton() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const rafId = useRef<number | null>(null);
  const hide = pathname?.includes('/admin') || pathname?.includes('/clen');

  useEffect(() => {
    if (hide) return;
    const update = () => {
      rafId.current = null;
      setProgress(getScrollProgress());
    };

    const onScroll = () => {
      if (rafId.current != null) return;
      rafId.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId.current != null) window.cancelAnimationFrame(rafId.current);
    };
  }, [hide]);

  const rounded = Math.round(progress);
  if (hide || rounded < 8) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-28 right-6 md:bottom-8 md:right-8 z-[9998] bg-stone-900 text-white rounded-2xl px-4 py-3 shadow-2xl hover:bg-green-600 transition-all flex items-center gap-3"
      aria-label="Back to top"
    >
      <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
        <ArrowUp size={18} />
      </span>
      <span className="text-xs font-black uppercase tracking-widest">{rounded}%</span>
    </button>
  );
}
