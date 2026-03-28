'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import { AlertTriangle, Clock, Inbox, RefreshCw, Save, Search, Trash2, Zap, X } from 'lucide-react';
import Portal from '@/app/components/ui/Portal';

type View = 'queue' | 'dead';

export default function QueueTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('queue');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const [edit, setEdit] = useState<any | null>(null);

  const limit = 60;
  const offset = Math.max(0, page) * limit;

  const queryKey = useMemo(() => ['admin_queue', view, status, kind, dueOnly, q, page], [view, status, kind, dueOnly, q, page]);
  const { data: listData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const url = new URL('/api/admin/queue', window.location.origin);
      url.searchParams.set('view', view);
      if (status) url.searchParams.set('status', status);
      if (kind) url.searchParams.set('kind', kind);
      if (dueOnly) url.searchParams.set('due', '1');
      if (q.trim()) url.searchParams.set('q', q.trim());
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return {
        items: Array.isArray(json?.items) ? json.items : [],
        count: Number(json?.count || 0),
      };
    },
  });

  const items = Array.isArray(listData?.items) ? listData.items : [];
  const total = Number(listData?.count || 0);
  const canPrev = page > 0;
  const canNext = (page + 1) * limit < total;

  const { data: summary } = useQuery({
    queryKey: ['admin_queue_summary'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/queue/summary', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return json;
    },
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const { data: detail } = useQuery({
    queryKey: ['admin_queue_detail', view, selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const endpoint =
        view === 'dead'
          ? `/api/admin/queue/dead/${encodeURIComponent(String(selected.id))}`
          : `/api/admin/queue/${encodeURIComponent(String(selected.id))}`;
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return json?.item || null;
    },
  });

  const errorInfo = (detail as any)?.meta?.last_error || (selected as any)?.meta?.last_error || (detail as any)?.meta?.enqueue_error;
  const errorHint =
    String(detail?.last_error || selected?.last_error || '').toLowerCase().includes('timeout')
      ? 'Tip: Connection timeout obvykle znamená blokovaný outbound SMTP port / firewall nebo špatný host.'
      : '';

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

  const unlockMutation = useMutation({
    mutationFn: async (payload: { id: string }) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/queue/${encodeURIComponent(payload.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ unlock: true, status: 'retry', next_attempt_at: new Date().toISOString() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_queue'] });
      qc.invalidateQueries({ queryKey: ['admin_queue_summary'] });
      showToast('Odemčeno a zařazeno do retry', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/queue/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limit: 50, resetStuck: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return json;
    },
    onSuccess: (json: any) => {
      qc.invalidateQueries({ queryKey: ['admin_queue'] });
      qc.invalidateQueries({ queryKey: ['admin_queue_summary'] });
      showToast(
        `Zpracováno: ${Number(json?.processed || 0)} • OK: ${Number(json?.okCount || 0)} • Retry: ${Number(json?.retried || 0)} • Dead: ${Number(json?.dead || 0)}`,
        'success',
      );
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { id: string; view: View }) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const endpoint =
        payload.view === 'dead'
          ? `/api/admin/queue/dead/${encodeURIComponent(payload.id)}`
          : `/api/admin/queue/${encodeURIComponent(payload.id)}`;
      const res = await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_queue'] });
      qc.invalidateQueries({ queryKey: ['admin_queue_summary'] });
      setSelected(null);
      showToast('Smazáno', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const title = view === 'queue' ? 'E-mail fronta' : 'Dead letters';
  const desc =
    view === 'queue'
      ? 'Neodeslané e-maily (čeká / retry / processing) + možnost ruční opravy.'
      : 'E-maily, které selhaly po maximálním počtu pokusů.';

  const statusLabel = (s: string) => {
    if (s === 'queued') return 'čeká';
    if (s === 'retry') return 'retry';
    if (s === 'processing') return 'processing';
    return s || '—';
  };

  const kindValue = (it: any) => String(it?.meta?.kind || '').trim();

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
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Hledat e-mail / subject / chybu"
                className="ml-2 w-64 bg-transparent text-sm font-bold text-stone-700 outline-none"
              />
            </div>
            <select
              value={view}
              onChange={(e) => {
                setSelected(null);
                setView(e.target.value === 'dead' ? 'dead' : 'queue');
                setPage(0);
              }}
              className="px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-700 shadow-sm"
            >
              <option value="queue">E-mail fronta</option>
              <option value="dead">Dead letters</option>
            </select>
            {view === 'queue' && (
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
                className="px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-700 shadow-sm"
              >
                <option value="">Všechny stavy</option>
                <option value="queued">queued</option>
                <option value="retry">retry</option>
                <option value="processing">processing</option>
              </select>
            )}
            <input
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(0);
              }}
              placeholder="kind (např. newsletter)"
              className="px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-700 shadow-sm w-56"
            />
            {view === 'queue' && (
              <button
                type="button"
                onClick={() => {
                  setDueOnly((v) => !v);
                  setPage(0);
                }}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest shadow-sm transition ${
                  dueOnly ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <Clock size={14} /> {dueOnly ? 'Due: zapnuto' : 'Due: vypnuto'}
              </button>
            )}
            {view === 'queue' ? (
              <button
                type="button"
                onClick={() => processMutation.mutate()}
                disabled={processMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-green-200 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition disabled:opacity-50 shadow-sm"
              >
                <Zap size={14} /> Zpracovat frontu
              </button>
            ) : null}
          </div>
        }
      />

      {view === 'queue' && summary?.queue ? (
        <div className="grid md:grid-cols-5 gap-3">
          <div className="bg-white border border-stone-100 rounded-[2rem] p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Čeká</div>
            <div className="mt-2 text-2xl font-black text-stone-900">{Number(summary.queue.queued || 0)}</div>
          </div>
          <div className="bg-white border border-stone-100 rounded-[2rem] p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Retry</div>
            <div className="mt-2 text-2xl font-black text-stone-900">{Number(summary.queue.retry || 0)}</div>
          </div>
          <div className="bg-white border border-stone-100 rounded-[2rem] p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Processing</div>
            <div className="mt-2 text-2xl font-black text-stone-900">{Number(summary.queue.processing || 0)}</div>
          </div>
          <div className="bg-white border border-stone-100 rounded-[2rem] p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Due teď</div>
            <div className="mt-2 text-2xl font-black text-stone-900">{Number(summary.queue.dueNow || 0)}</div>
          </div>
          <div className="bg-white border border-stone-100 rounded-[2rem] p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Zaseknuté</div>
            <div className="mt-2 text-2xl font-black text-stone-900">{Number(summary.queue.stuckProcessing || 0)}</div>
          </div>
        </div>
      ) : view === 'dead' && summary?.deadLetters ? (
        <div className="grid md:grid-cols-4 gap-3">
          <div className="bg-white border border-stone-100 rounded-[2rem] p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Dead letters</div>
            <div className="mt-2 text-2xl font-black text-stone-900">{Number(summary.deadLetters.total || 0)}</div>
          </div>
        </div>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <AdminEmptyState icon={Inbox} title="Žádné položky" description="Fronta je prázdná." />
      ) : (
        <div className="bg-white border border-stone-100 rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Kind</th>
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
                    <td className="px-6 py-4 text-xs font-black text-stone-500 max-w-[220px] truncate">{kindValue(it) || '—'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-stone-800 max-w-[260px] truncate">{String(it.to_email || '')}</td>
                    <td className="px-6 py-4 text-sm font-bold text-stone-800 max-w-[460px] truncate">{String(it.subject || '')}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-stone-100 text-stone-700">
                        {String(view === 'dead' ? 'dead' : statusLabel(String(it.status || '')))}
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

          <div className="flex items-center justify-between px-6 py-4 bg-white">
            <div className="text-xs font-bold text-stone-500">
              Zobrazeno {items.length} z {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!canPrev}
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-[10px] font-black uppercase tracking-widest text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                Předchozí
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!canNext}
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-[10px] font-black uppercase tracking-widest text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                Další
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <Portal>
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/40">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{title}</div>
                <div className="text-2xl font-black text-stone-900 tracking-tight truncate max-w-[52ch]">{String(detail?.subject || selected.subject || '')}</div>
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
                        <div className="text-sm font-black text-stone-900 break-all">{String(detail?.to_email || selected.to_email || '')}</div>
                      </div>
                      <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">From</div>
                        <div className="text-sm font-black text-stone-900 break-all">{String(detail?.from_email || selected.from_email || '')}</div>
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
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate({ id: String(selected.id), view })}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-red-200 text-red-700 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition disabled:opacity-50"
                      >
                        <Trash2 size={14} /> Smazat
                      </button>
                      {view === 'queue' && String(detail?.status || selected.status || '') === 'processing' && (
                        <button
                          type="button"
                          onClick={() => unlockMutation.mutate({ id: String(selected.id) })}
                          disabled={unlockMutation.isPending}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 transition disabled:opacity-50"
                        >
                          <AlertTriangle size={14} /> Odemknout
                        </button>
                      )}
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
                    <div className="text-sm font-black text-stone-900">
                      {String(view === 'dead' ? 'dead' : statusLabel(String(detail?.status || selected.status || '')))}
                    </div>
                  </div>
                  <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Last error</div>
                    <div className="text-xs font-bold text-stone-700 break-words">{String(detail?.last_error || detail?.final_error || selected.last_error || selected.final_error || '—')}</div>
                    {errorHint ? <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400">{errorHint}</div> : null}
                  </div>
                  {errorInfo ? (
                    <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Diagnostika</div>
                      <div className="text-xs font-mono text-stone-700 whitespace-pre-wrap break-words rounded-xl bg-white border border-stone-100 p-4">
                        {JSON.stringify(errorInfo, null, 2)}
                      </div>
                    </div>
                  ) : null}
                  <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">HTML (preview)</div>
                    <div className="text-xs font-mono text-stone-700 whitespace-pre-wrap max-h-48 overflow-auto rounded-xl bg-white border border-stone-100 p-4">
                      {detail ? String(detail.html || '').slice(0, 1600) || '—' : 'Načítám…'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
