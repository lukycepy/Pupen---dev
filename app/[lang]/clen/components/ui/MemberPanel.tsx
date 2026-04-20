'use client';

import React from 'react';

export default function MemberPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        'rounded-[2.5rem] border border-stone-200 bg-white/80 backdrop-blur shadow-[0_1px_0_rgba(0,0,0,0.03),0_18px_60px_rgba(0,0,0,0.06)]',
        className || '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
