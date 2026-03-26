'use client';

import React from 'react';
import Panel from '@/app/components/ui/Panel';

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
    <Panel radius="2xl" className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-stone-900 tracking-tight truncate">{title}</h2>
          {description ? <p className="text-stone-400 text-xs font-medium mt-1">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">{actions}</div> : null}
      </div>
    </Panel>
  );
}
