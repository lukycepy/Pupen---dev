'use client';

import React from 'react';

export default function AdminPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`bg-white rounded-[2.5rem] border border-stone-100 shadow-sm ${className}`}>{children}</div>;
}

