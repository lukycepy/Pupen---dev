'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function RouteLoadingBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    timeouts.current.forEach((t) => window.clearTimeout(t));
    timeouts.current = [];

    setVisible(true);
    setProgress(0);

    const t1 = window.setTimeout(() => setProgress(0.75), 80);
    const t2 = window.setTimeout(() => setProgress(0.9), 260);
    const t3 = window.setTimeout(() => setProgress(1), 420);
    const t4 = window.setTimeout(() => setVisible(false), 620);

    timeouts.current.push(t1, t2, t3, t4);

    return () => {
      timeouts.current.forEach((t) => window.clearTimeout(t));
      timeouts.current = [];
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed left-0 top-0 w-full h-[3px] z-[10000] bg-transparent">
      <div
        className="h-full bg-green-600 origin-left transition-transform duration-200"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />
    </div>
  );
}

