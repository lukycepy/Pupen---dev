'use client';

import React from 'react';

export default function MemberPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[3rem] border border-stone-100 shadow-sm ${className || ''}`.trim()}>
      {children}
    </div>
  );
}

