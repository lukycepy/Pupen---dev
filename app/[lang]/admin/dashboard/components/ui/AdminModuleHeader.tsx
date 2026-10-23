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
    <div className="rounded-[2.25rem] border-2 border-black bg-white p-6 dark:border-white dark:bg-black">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-black md:text-3xl dark:text-white">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm font-medium text-black/75 dark:text-white/75">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3 lg:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}
