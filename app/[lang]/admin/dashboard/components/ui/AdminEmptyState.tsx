'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export default function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 bg-white rounded-[2.5rem] border border-dashed border-stone-200">
      <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center">
        <Icon className="text-stone-400" size={26} />
      </div>
      <div className="text-stone-900 font-black">{title}</div>
      {description ? <div className="text-stone-400 text-sm font-medium mt-2 max-w-md mx-auto">{description}</div> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

