'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, Globe, Laptop, Clock } from 'lucide-react';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import AdminPanel from './ui/AdminPanel';
import { useToast } from '../../../../context/ToastContext';

export default function ErrorLogsTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['error_logs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/error-logs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.logs || [];
    },
    refetchInterval: 10000 // Refresh every 10s
  });

  const purgeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/error-logs', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error_logs'] });
      showToast('Logy byly smazány', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title="Chyby (Error Logs)"
        description="Záznamy chyb zachycených v aplikaci"
        actions={
          logs.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Opravdu chcete smazat VŠECHNY záznamy chyb?')) {
                  purgeMutation.mutate();
                }
              }}
              disabled={purgeMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition disabled:opacity-50"
            >
              <Trash2 size={16} /> Smazat vše
            </button>
          )
        }
      />

      {logs.length === 0 ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title="Žádné chyby"
          description="Aplikace běží bez zaznamenaných chyb."
        />
      ) : (
        <div className="space-y-4">
          {logs.map((log: any) => (
            <AdminPanel key={log.id} className="p-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start mb-4">
                <div className="flex gap-3 items-start">
                  <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    log.level === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 break-all">{log.message}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(log.created_at).toLocaleString()}</span>
                      {log.url && <span className="flex items-center gap-1 max-w-[200px] truncate" title={log.url}><Globe size={12} /> {new URL(log.url).pathname}</span>}
                      {log.profiles?.email && <span className="flex items-center gap-1"><span className="text-stone-500">USER:</span> {log.profiles.email}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {log.stack && (
                <div className="bg-stone-900 rounded-xl p-4 overflow-x-auto mt-4">
                  <pre className="text-xs font-mono text-stone-300 leading-relaxed">
                    {log.stack}
                  </pre>
                </div>
              )}

              {log.user_agent && (
                <div className="mt-4 flex items-start gap-2 text-xs text-stone-500 bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <Laptop size={14} className="shrink-0 mt-0.5" />
                  <span className="break-all">{log.user_agent}</span>
                </div>
              )}
            </AdminPanel>
          ))}
        </div>
      )}
    </div>
  );
}
