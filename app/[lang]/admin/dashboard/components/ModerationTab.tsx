'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock, Search, Shield, X } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { logAdminAction } from '@/lib/admin-logger';

export default function ModerationTab({
  currentUser,
  userProfile,
}: {
  currentUser: any;
  userProfile: any;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');

  const { data, isLoading } = useQuery({
    queryKey: ['moderation_reports'],
    queryFn: async () => {
      const res = await supabase
        .from('admin_logs')
        .select('id, created_at, action, target_id, details, admin_email, admin_name')
        .ilike('action', 'REPORT:%')
        .order('created_at', { ascending: false })
        .limit(300);
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  const rows = useMemo(() => {
    const items = data || [];
    const query = q.trim().toLowerCase();
    return items.filter((r: any) => {
      const d = r.details || {};
      const st = d.status || 'open';
      if (status !== 'all' && st !== status) return false;
      if (!query) return true;
      const hay = `${r.action} ${r.target_id || ''} ${d.reporterEmail || ''} ${d.targetLabel || ''} ${d.reason || ''} ${d.details || ''}`.toLowerCase();
      return hay.includes(query);
    });
  }, [data, q, status]);

  const resolveMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: row, error } = await supabase.from('admin_logs').select('id, details').eq('id', id).single();
      if (error) throw error;
      const details = row?.details || {};
      const next = {
        ...details,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: currentUser?.email || null,
      };
      const upd = await supabase.from('admin_logs').update({ details: next }).eq('id', id);
      if (upd.error) throw upd.error;
      try {
        await logAdminAction(
          currentUser?.email,
          `MODERATION:resolve report ${id}`,
          id,
          { target: details?.targetId, targetType: details?.targetType },
          userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined
        );
      } catch {}
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moderation_reports'] });
      showToast('Vyřešeno', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const reopenMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: row, error } = await supabase.from('admin_logs').select('id, details').eq('id', id).single();
      if (error) throw error;
      const details = row?.details || {};
      const next = {
        ...details,
        status: 'open',
        reopenedAt: new Date().toISOString(),
        reopenedBy: currentUser?.email || null,
      };
      const upd = await supabase.from('admin_logs').update({ details: next }).eq('id', id);
      if (upd.error) throw upd.error;
      try {
        await logAdminAction(
          currentUser?.email,
          `MODERATION:reopen report ${id}`,
          id,
          { target: details?.targetId, targetType: details?.targetType },
          userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined
        );
      } catch {}
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moderation_reports'] });
      showToast('Znovu otevřeno', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <Shield className="text-green-600" />
              Moderace
            </h2>
            <p className="text-stone-500 font-medium">Fronta nahlášení obsahu/uživatelů.</p>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-7 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat…"
              className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
            />
          </div>
          <div className="md:col-span-5 flex items-center gap-2">
            {(['open', 'resolved', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex-1 px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  status === s ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {s === 'open' ? 'Otevřené' : s === 'resolved' ? 'Vyřešené' : 'Vše'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            Zatím žádná hlášení.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.slice(0, 200).map((r: any) => {
              const d = r.details || {};
              const st = d.status || 'open';
              return (
                <div key={r.id} className="p-5 bg-stone-50 rounded-[2rem] border border-stone-100">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-amber-600" />
                        <div className="font-black text-stone-900 truncate">{d.targetLabel || d.targetId || r.target_id}</div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            st === 'resolved' ? 'bg-stone-200 text-stone-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {st === 'resolved' ? 'resolved' : 'open'}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-stone-700">
                        {d.reason || r.action}
                      </div>
                      {d.details && <div className="mt-2 text-sm font-medium text-stone-600 whitespace-pre-line">{String(d.details)}</div>}
                      <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-stone-300 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2">
                          <Clock size={12} /> {r.created_at ? new Date(r.created_at).toLocaleString('cs-CZ') : '—'}
                        </span>
                        {d.reporterEmail && <span>{d.reporterEmail}</span>}
                        {d.sourceUrl && <span className="truncate max-w-[320px]">{d.sourceUrl}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {st !== 'resolved' ? (
                        <button
                          type="button"
                          onClick={() => resolveMutation.mutate({ id: r.id })}
                          disabled={resolveMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {resolveMutation.isPending ? <InlinePulse className="bg-white/80" size={12} /> : <CheckCircle size={16} />}
                          Vyřešit
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => reopenMutation.mutate({ id: r.id })}
                          disabled={reopenMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                        >
                          {reopenMutation.isPending ? <InlinePulse className="bg-stone-300" size={12} /> : <X size={16} />}
                          Znovu otevřít
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

