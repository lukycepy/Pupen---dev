'use client';

import React from 'react';

export default function AdminModuleHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
      <div className="min-w-0">
        <h2 className="text-2xl font-black text-stone-900 tracking-tight truncate">{title}</h2>
        {description ? <p className="text-stone-400 text-xs font-medium mt-1">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3 shrink-0">{actions}</div> : null}
    </div>
  );
}

