'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { History, User, Activity, Clock, Loader2, Info } from 'lucide-react';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';

export default function LogsTab() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin_logs'],
    queryFn: async () => {
      const { data } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    }
  });

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
      <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
        <History className="text-green-600" />
        Historie aktivit adminů
      </h2>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <p className="text-center py-12 text-stone-400 font-bold uppercase tracking-widest text-xs">Zatím žádné záznamy.</p>
        ) : (
          logs.map((log: any) => (
            <div key={log.id} className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100 group transition hover:bg-white hover:shadow-lg">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shrink-0 shadow-sm font-black uppercase text-xs">
                {log.admin_name?.[0] || log.admin_email?.[0]}
              </div>
              <div className="flex-grow">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-1 gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-sm">{log.admin_name || log.admin_email}</span>
                    <span className="text-[10px] text-stone-400 font-medium">({log.admin_email})</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1 shrink-0">
                    <Clock size={10} /> {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-stone-600 font-medium">
                  <span className="text-green-600 font-black uppercase tracking-tighter text-[10px] mr-2">Akce</span>
                  {log.action}
                </p>
                {log.details && (
                  <div className="mt-2 text-[10px] text-stone-400 bg-white p-2 rounded-lg border border-stone-50 font-mono line-clamp-1 group-hover:line-clamp-none transition-all">
                    {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
