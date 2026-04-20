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
    <div className="rounded-[2.5rem] border border-stone-200 bg-gradient-to-b from-white to-stone-50 p-7 shadow-[0_1px_0_rgba(0,0,0,0.03),0_16px_50px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight truncate">{title}</h2>
          {description ? <p className="text-stone-500 text-sm font-medium mt-2 max-w-3xl">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}
