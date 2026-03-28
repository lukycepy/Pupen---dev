'use client';

import React, { useEffect, useRef, useState } from 'react';
import Portal from '@/app/components/ui/Portal';

function getProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const scrollHeight = doc.scrollHeight || 0;
  const clientHeight = doc.clientHeight || 0;
  const max = Math.max(1, scrollHeight - clientHeight);
  return Math.min(1, Math.max(0, scrollTop / max));
}

export default function ScrollProgressBar() {
  const [p, setP] = useState(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      rafId.current = null;
      setP(getProgress());
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
  }, []);

  return (
    <Portal>
      <div className="fixed left-0 top-0 w-full h-[3px] z-[9999] bg-transparent">
        <div
          className="h-full bg-green-600 origin-left"
          style={{ transform: `scaleX(${p})` }}
          aria-hidden="true"
        />
      </div>
    </Portal>
  );
}
