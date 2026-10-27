'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import { AlertTriangle, Clock, Inbox, RefreshCw, Save, Search, Trash2, Zap, X } from 'lucide-react';
import Dialog from '@/app/components/ui/Dialog';
import { useParams } from 'next/navigation';
import type { Dictionary } from '@/lib/dictionary-types';

type View = 'queue' | 'dead';

export default function QueueTab({ dict }: { dict: Dictionary }) {
  const params = useParams();
  const lang = (params?.lang as string) === 'en' ? 'en' : 'cs';
  const t = dict.admin.queue;
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
      ? t.hintTimeout
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

  const title = view === 'queue' ? String(t.titleQueue) : String(t.titleDead);
  const desc = view === 'queue' ? String(t.descQueue) : String(t.descDead);
  const queueLabels = {
    kind: String((t as any).kind || (lang === 'en' ? 'Type' : 'Typ')),
    from: String((t as any).from || 'From'),
    replyTo: String((t as any).replyTo || 'Reply-To'),
    maxAttempts: String((t as any).maxAttempts || (lang === 'en' ? 'Max attempts' : 'Max. pokusů')),
    nextAttemptIso: String((t as any).nextAttemptIso || (lang === 'en' ? 'Next attempt (ISO)' : 'Další pokus (ISO)')),
    actions: String((t as any).actions || (lang === 'en' ? 'Actions' : 'Akce')),
    lastError: String((t as any).lastError || (lang === 'en' ? 'Last error' : 'Poslední chyba')),
    diagnostics: String((t as any).diagnostics || (lang === 'en' ? 'Diagnostics' : 'Diagnostika')),
    htmlPreview: String((t as any).htmlPreview || (lang === 'en' ? 'HTML (preview)' : 'HTML (náhled)')),
    loading: String((t as any).loading || (lang === 'en' ? 'Loading…' : 'Načítám…')),
    retry: String((t as any).retry || 'Retry'),
    save: String((t as any).save || (lang === 'en' ? 'Save' : 'Uložit')),
    unlock: String((t as any).unlock || (lang === 'en' ? 'Unlock' : 'Odemknout')),
    delete: String((t as any).delete || (lang === 'en' ? 'Delete' : 'Smazat')),
  };

  const statusLabel = (s: string) => {
    const raw = String(s || '').trim();
    const mapped = (t.status as any)?.[raw];
    if (mapped) return String(mapped);
    if (!raw) return '—';
    if (raw === 'queued') return String(t.status.queued);
    if (raw === 'retry') return String(t.status.retry);
    if (raw === 'processing') return String(t.status.processing);
    if (raw === 'dead') return String(t.status.dead);
    return raw;
  };

  const kindValue = (it: any) => String(it?.meta?.kind || '').trim();
  const dateLocale = ({ en: 'en-US', cs: 'cs-CZ' } as const)[lang];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader title={title} description={desc} />

      <div className="rounded-[2.25rem] border-2 border-black bg-white p-4 dark:border-white dark:bg-black md:p-5">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.6fr)_180px_180px_220px_auto_auto]">
          <label className="inline-flex items-center rounded-2xl border-2 border-black bg-white px-4 py-3 text-black transition focus-within:border-green-600 dark:border-white dark:bg-black dark:text-white dark:focus-within:border-green-500">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder={t.searchPlaceholder}
              className="ml-3 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-black/50 dark:placeholder:text-white/60"
            />
          </label>
          <select
            value={view}
            onChange={(e) => {
              setSelected(null);
              setView(e.target.value === 'dead' ? 'dead' : 'queue');
              setPage(0);
            }}
            className="rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none transition focus:border-green-600 dark:border-white dark:bg-black dark:text-white dark:focus:border-green-500"
          >
            <option value="queue">{String(t.tabQueue)}</option>
            <option value="dead">{String(t.tabDead)}</option>
          </select>
          {view === 'queue' ? (
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
              className="rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none transition focus:border-green-600 dark:border-white dark:bg-black dark:text-white dark:focus:border-green-500"
            >
              <option value="">{t.allStatuses}</option>
              <option value="queued">{statusLabel('queued')}</option>
              <option value="retry">{statusLabel('retry')}</option>
              <option value="processing">{statusLabel('processing')}</option>
            </select>
          ) : (
            <div className="hidden xl:block" />
          )}
          <input
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(0);
            }}
            placeholder={t.kindPlaceholder}
            className="rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none transition placeholder:text-black/50 focus:border-green-600 dark:border-white dark:bg-black dark:text-white dark:placeholder:text-white/60 dark:focus:border-green-500"
          />
          {view === 'queue' ? (
            <button
              type="button"
              onClick={() => {
                setDueOnly((v) => !v);
                setPage(0);
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition ${
                dueOnly
                  ? 'border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-950 dark:text-green-400'
                  : 'border-black bg-white text-black hover:border-green-600 hover:bg-green-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950'
              }`}
            >
              <Clock size={14} /> {dueOnly ? t.dueOn : t.dueOff}
            </button>
          ) : (
            <div className="hidden xl:block" />
          )}
          {view === 'queue' ? (
            <button
              type="button"
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-green-600 bg-green-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              <Zap size={14} /> {t.processQueue}
            </button>
          ) : (
            <div className="hidden xl:block" />
          )}
        </div>
      </div>

      {view === 'queue' && summary?.queue ? (
        <div className="grid md:grid-cols-5 gap-3">
          <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{statusLabel('queued')}</div>
            <div className="mt-2 text-2xl font-black text-black dark:text-white">{Number(summary.queue.queued || 0)}</div>
          </div>
          <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{statusLabel('retry')}</div>
            <div className="mt-2 text-2xl font-black text-black dark:text-white">{Number(summary.queue.retry || 0)}</div>
          </div>
          <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{statusLabel('processing')}</div>
            <div className="mt-2 text-2xl font-black text-black dark:text-white">{Number(summary.queue.processing || 0)}</div>
          </div>
          <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.summaryDueNow}</div>
            <div className="mt-2 text-2xl font-black text-black dark:text-white">{Number(summary.queue.dueNow || 0)}</div>
          </div>
          <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.summaryStuck}</div>
            <div className="mt-2 text-2xl font-black text-black dark:text-white">{Number(summary.queue.stuckProcessing || 0)}</div>
          </div>
        </div>
      ) : view === 'dead' && summary?.deadLetters ? (
        <div className="grid md:grid-cols-4 gap-3">
          <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{String(t?.tabDead || 'Dead letters')}</div>
            <div className="mt-2 text-2xl font-black text-black dark:text-white">{Number(summary.deadLetters.total || 0)}</div>
          </div>
        </div>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <AdminEmptyState
          icon={Inbox}
          title={t.emptyTitle}
          description={t.emptyDescription}
        />
      ) : (
        <div className="overflow-hidden rounded-[2.5rem] border-2 border-black bg-white dark:border-white dark:bg-black">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b-2 border-black bg-white dark:border-white dark:bg-black">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.kind}</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.to}</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.subject}</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.status}</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.attempts}</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.nextFailed}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <tr
                    key={String(it.id)}
                    className="cursor-pointer border-b border-black/10 transition hover:bg-green-50 dark:border-white/10 dark:hover:bg-green-950"
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
                    <td className="max-w-[220px] truncate px-6 py-4 text-xs font-black text-black/70 dark:text-white/70">{kindValue(it) || '—'}</td>
                    <td className="max-w-[260px] truncate px-6 py-4 text-sm font-bold text-black dark:text-white">{String(it.to_email || '')}</td>
                    <td className="max-w-[460px] truncate px-6 py-4 text-sm font-bold text-black dark:text-white">{String(it.subject || '')}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full border-2 border-black px-3 py-1 text-[9px] font-black uppercase tracking-widest text-black dark:border-white dark:text-white">
                        {String(view === 'dead' ? statusLabel('dead') : statusLabel(String(it.status || '')))}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-black/70 dark:text-white/70">{Number(it.attempt_count || 0)}/{Number(it.max_attempts || 0) || '—'}</td>
                    <td className="px-6 py-4 text-xs font-bold text-black/70 dark:text-white/70">
                      {view === 'dead'
                        ? (it.failed_at ? new Date(it.failed_at).toLocaleString(dateLocale) : '—')
                        : (it.next_attempt_at ? new Date(it.next_attempt_at).toLocaleString(dateLocale) : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t-2 border-black px-6 py-4 dark:border-white">
            <div className="text-xs font-bold text-black/70 dark:text-white/70">
              {t.pagination.showing} {items.length} {t.pagination.of} {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!canPrev}
                className="rounded-xl border-2 border-black bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 disabled:opacity-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
              >
                {t.pagination.previous}
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!canNext}
                className="rounded-xl border-2 border-black bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 disabled:opacity-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
              >
                {t.pagination.next}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <Dialog
          open={!!selected}
          onClose={() => setSelected(null)}
          overlayClassName="fixed inset-0 z-[30000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6 animate-in fade-in duration-300"
          panelClassName="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[3rem] border-2 border-black bg-white dark:border-white dark:bg-black"
        >
          <div className="flex items-start justify-between border-b-2 border-black p-8 dark:border-white">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{title}</div>
                <div className="max-w-[52ch] text-2xl font-black tracking-tight text-black dark:text-white">{String(detail?.subject || selected.subject || '')}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-2xl border-2 border-black p-3 text-black transition hover:border-green-600 hover:bg-green-50 dark:border-white dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {view === 'queue' ? (
                    <div className="space-y-4 rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
                      <div>
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.to}</div>
                        <input
                          value={String(edit?.to_email || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), to_email: e.target.value }))}
                          className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none dark:border-white dark:bg-black dark:text-white"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.from}</div>
                        <input
                          value={String(edit?.from_email || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), from_email: e.target.value }))}
                          className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none dark:border-white dark:bg-black dark:text-white"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.replyTo}</div>
                        <input
                          value={String(edit?.reply_to || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), reply_to: e.target.value }))}
                          className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none dark:border-white dark:bg-black dark:text-white"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.subject}</div>
                        <input
                          value={String(edit?.subject || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), subject: e.target.value }))}
                          className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none dark:border-white dark:bg-black dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.status}</div>
                          <select
                            value={String(edit?.status || 'queued')}
                            onChange={(e) => setEdit((p: any) => ({ ...(p || {}), status: e.target.value }))}
                            className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none dark:border-white dark:bg-black dark:text-white"
                          >
                            <option value="queued">{statusLabel('queued')}</option>
                            <option value="retry">{statusLabel('retry')}</option>
                            <option value="processing">{statusLabel('processing')}</option>
                          </select>
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.maxAttempts}</div>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={Number(edit?.max_attempts || 5)}
                            onChange={(e) => setEdit((p: any) => ({ ...(p || {}), max_attempts: Number(e.target.value) }))}
                            className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none dark:border-white dark:bg-black dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.nextAttemptIso}</div>
                        <input
                          value={String(edit?.next_attempt_at || '')}
                          onChange={(e) => setEdit((p: any) => ({ ...(p || {}), next_attempt_at: e.target.value }))}
                          className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-xs font-bold text-black outline-none dark:border-white dark:bg-black dark:text-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.to}</div>
                        <div className="break-all text-sm font-black text-black dark:text-white">{String(detail?.to_email || selected.to_email || '')}</div>
                      </div>
                      <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.from}</div>
                        <div className="break-all text-sm font-black text-black dark:text-white">{String(detail?.from_email || selected.from_email || '')}</div>
                      </div>
                    </div>
                  )}
                  <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
                    <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.actions}</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => retryMutation.mutate({ id: String(selected.id) })}
                        disabled={retryMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-green-600 bg-green-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        <RefreshCw size={14} /> {queueLabels.retry}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate({ id: String(selected.id), view })}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-red-600 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500 dark:bg-black dark:text-red-400 dark:hover:bg-red-950"
                      >
                        <Trash2 size={14} /> {queueLabels.delete}
                      </button>
                      {view === 'queue' && String(detail?.status || selected.status || '') === 'processing' && (
                        <button
                          type="button"
                          onClick={() => unlockMutation.mutate({ id: String(selected.id) })}
                          disabled={unlockMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 disabled:opacity-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
                        >
                          <AlertTriangle size={14} /> {queueLabels.unlock}
                        </button>
                      )}
                      {view === 'queue' && (
                        <button
                          type="button"
                          onClick={() => updateMutation.mutate({ id: String(selected.id), patch: edit || {} })}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:border-green-600 hover:bg-green-50 disabled:opacity-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950"
                        >
                          <Save size={14} /> {queueLabels.save}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{t.table.status}</div>
                    <div className="text-sm font-black text-black dark:text-white">
                      {String(view === 'dead' ? 'dead' : statusLabel(String(detail?.status || selected.status || '')))}
                    </div>
                  </div>
                  <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.lastError}</div>
                    <div className="break-words text-xs font-bold text-black/80 dark:text-white/80">{String(detail?.last_error || detail?.final_error || selected.last_error || selected.final_error || '—')}</div>
                    {errorHint ? <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{errorHint}</div> : null}
                  </div>
                  {errorInfo ? (
                    <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
                      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.diagnostics}</div>
                      <div className="whitespace-pre-wrap break-words rounded-xl border-2 border-black bg-white p-4 font-mono text-xs text-black/80 dark:border-white dark:bg-black dark:text-white/80">
                        {JSON.stringify(errorInfo, null, 2)}
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-[2rem] border-2 border-black bg-white p-5 dark:border-white dark:bg-black">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">{queueLabels.htmlPreview}</div>
                    <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border-2 border-black bg-white p-4 font-mono text-xs text-black/80 dark:border-white dark:bg-black dark:text-white/80">
                      {detail ? String(detail.html || '').slice(0, 1600) || '—' : queueLabels.loading}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </Dialog>
      )}
    </div>
  );
}
