import React from 'react';
import type { LucideIcon } from 'lucide-react';

export default function PageHeader({
  icon: Icon,
  badge,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  badge?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="bg-white p-10 md:p-12 rounded-[3rem] border border-stone-100 shadow-sm">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {badge ? (
            <div className="flex items-center gap-3 mb-4">
              {Icon ? (
                <div className="p-2 bg-stone-900 rounded-xl text-white shadow-sm">
                  <Icon size={18} />
                </div>
              ) : null}
              <span className="text-stone-900 font-black uppercase tracking-[0.2em] text-[10px]">{badge}</span>
            </div>
          ) : null}
          <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight">{title}</h1>
          {subtitle ? <p className="text-stone-500 font-medium mt-4">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
