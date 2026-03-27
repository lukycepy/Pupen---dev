'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import { Inbox, RefreshCw, Save, Search, X } from 'lucide-react';

type View = 'queue' | 'dead';

export default function QueueTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('queue');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [edit, setEdit] = useState<any | null>(null);

  const queryKey = useMemo(() => ['admin_queue', view, status, q], [view, status, q]);
  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const url = new URL('/api/admin/queue', window.location.origin);
      url.searchParams.set('view', view);
      if (status) url.searchParams.set('status', status);
      if (q.trim()) url.searchParams.set('q', q.trim());
      url.searchParams.set('limit', '120');
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return Array.isArray(json?.items) ? json.items : [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; patch: any }) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/queue/${encodeURIComponent(payload.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload.patch || {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_queue'] });
      showToast('Uloženo', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const retryMutation = useMutation({
    mutationFn: async (payload: { id: string }) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const endpoint = view === 'dead' ? `/api/admin/queue/dead/${encodeURIComponent(payload.id)}/retry` : `/api/admin/queue/${encodeURIComponent(payload.id)}/retry`;
      const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_queue'] });
      setSelected(null);
      showToast('Zařazeno do fronty', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const title = view === 'queue' ? 'Queue' : 'Dead letters';
  const desc = view === 'queue' ? 'E-maily čekající na odeslání nebo retry.' : 'E-maily, které selhaly po maximálním počtu pokusů.';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={title}
        description={desc}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
              <Search size={16} className="text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Hledat e-mail / subject / chybu"
                className="ml-2 w-64 bg-transparent text-sm font-bold text-stone-700 outline-none"
              />
            </div>
            <select
              value={view}
              onChange={(e) => {
                setSelected(null);
                setView(e.target.value === 'dead' ? 'dead' : 'queue');
              }}
              className="px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-700 shadow-sm"
            >
              <option value="queue">Queue</option>
              <option value="dead">Dead letters</option>
            </select>
            {view === 'queue' && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-700 shadow-sm"
              >
                <option value="">Všechny stavy</option>
                <option value="queued">queued</option>
                <option value="retry">retry</option>
                <option value="processing">processing</option>
              </select>
            )}
          </div>
        }
      />

      {!isLoading && items.length === 0 ? (
        <AdminEmptyState icon={Inbox} title="Žádné položky" description="Fronta je prázdná." />
      ) : (
        <div className="bg-white border border-stone-100 rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">To</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Subject</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Attempts</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Next / Failed</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <tr
                    key={String(it.id)}
                    className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                    onClick={() => {
                      setSelected(it);
                      if (view === 'queue') {
                        setEdit({
                          status: String(it.status || 'queued'),
                          to_email: String(it.to_email || ''),
                          from_email: String(it.from_email || ''),
                          reply_to: String(it.reply_to || ''),
                          subject: String(it.subject || ''),
                          max_attempts: Number(it.max_attempts || 5),
                          next_attempt_at: String(it.next_attempt_at || new Date().toISOString()),
                        });
                      } else {
                        setEdit(null);
                      }
                    }}
                  >
                    <td className="px-6 py-4 text-sm font-bold text-stone-800 max-w-[260px] truncate">{String(it.to_email || '')}</td>
                    <td className="px-6 py-4 text-sm font-bold text-stone-800 max-w-[460px] truncate">{String(it.subject || '')}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-stone-100 text-stone-700">
                        {String(view === 'dead' ? 'dead' : it.status || '—')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-stone-500">{Number(it.attempt_count || 0)}/{Number(it.max_attempts || 0) || '—'}</td>
                    <td className="px-6 py-4 text-xs font-bold text-stone-500">
                      {view === 'dead'
                        ? (it.failed_at ? new Date(it.failed_at).toLocaleString('cs-CZ') : '—')
                        : (it.next_attempt_at ? new Date(it.next_attempt_at).toLocaleString('cs-CZ') : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/40">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{title}</div>
                <div className="text-2xl font-black text-stone-900 tracking-tight truncate max-w-[52ch]">{String(selected.subject || '')}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-3 hover:bg-stone-100 rounded-2xl transition text-stone-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {view === 'queue' ? (
                    <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5 space-y-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">To</div>
                        <input
                          value={String(edit?.to_email || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), to_email: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-800"
                        />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">From</div>
                        <input
                          value={String(edit?.from_email || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), from_email: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-800"
                        />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Reply-To</div>
                        <input
                          value={String(edit?.reply_to || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), reply_to: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-800"
                        />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Subject</div>
                        <input
                          value={String(edit?.subject || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), subject: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Status</div>
                          <select
                            value={String(edit?.status || 'queued')}
                            onChange={(e) => setEdit((p: any) => ({ ...(p || {}), status: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-800"
                          >
                            <option value="queued">queued</option>
                            <option value="retry">retry</option>
                            <option value="processing">processing</option>
                          </select>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Max attempts</div>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={Number(edit?.max_attempts || 5)}
                            onChange={(e) => setEdit((p: any) => ({ ...(p || {}), max_attempts: Number(e.target.value) }))}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-800"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Next attempt (ISO)</div>
                        <input
                          value={String(edit?.next_attempt_at || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), next_attempt_at: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-800"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">To</div>
                        <div className="text-sm font-black text-stone-900 break-all">{String(selected.to_email || '')}</div>
                      </div>
                      <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">From</div>
                        <div className="text-sm font-black text-stone-900 break-all">{String(selected.from_email || '')}</div>
                      </div>
                    </div>
                  )}
                  <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Akce</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => retryMutation.mutate({ id: String(selected.id) })}
                        disabled={retryMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition disabled:opacity-50"
                      >
                        <RefreshCw size={14} /> Retry
                      </button>
                      {view === 'queue' && (
                        <button
                          type="button"
                          onClick={() => updateMutation.mutate({ id: String(selected.id), patch: edit || {} })}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-stone-200 text-stone-800 text-[10px] font-black uppercase tracking-widest hover:bg-stone-50 transition disabled:opacity-50"
                        >
                          <Save size={14} /> Uložit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Status</div>
                    <div className="text-sm font-black text-stone-900">{String(view === 'dead' ? 'dead' : selected.status || '')}</div>
                  </div>
                  <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Last error</div>
                    <div className="text-xs font-bold text-stone-700 break-words">{String(selected.last_error || selected.final_error || '—')}</div>
                  </div>
                  <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">HTML (preview)</div>
                    <div className="text-xs font-mono text-stone-700 whitespace-pre-wrap max-h-48 overflow-auto rounded-xl bg-white border border-stone-100 p-4">
                      {String(selected.html || '').slice(0, 1600) || '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
