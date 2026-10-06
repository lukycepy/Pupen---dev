'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, Save, Search, CheckCircle, X, Mail } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';
import AdminEmptyState from './ui/AdminEmptyState';

export default function RefundsTab({ dict }: { dict: any }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'open' | 'approved' | 'denied' | 'paid' | 'all'>('open');
  const [policyDraft, setPolicyDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<'open' | 'approved' | 'denied' | 'paid'>('open');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const loadPolicy = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Unauthorized');
    const res = await fetch('/api/governance/refund-policy', { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Request failed');
    return String(json?.text || '');
  }, []);

  const { isLoading: policyLoading } = useQuery({
    queryKey: ['refund_policy'],
    queryFn: async () => {
      const text = await loadPolicy();
      setPolicyDraft(text);
      return text;
    },
  });

  const savePolicyMutation = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/refund-policy/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: policyDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['refund_policy'] });
      showToast('Uloženo', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const { data: refundLogs = [], isLoading } = useQuery({
    queryKey: ['refund_logs'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/refunds/logs?limit=800', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return Array.isArray(json.rows) ? json.rows : [];
    },
  });

  const { requests, workflowByRequestId } = useMemo(() => {
    const map = new Map<string, any>();
    const reqs: any[] = [];
    for (const row of refundLogs as any[]) {
      if (row.action === 'REFUND_WORKFLOW') {
        const reqId = row.details?.refundLogId ? String(row.details.refundLogId) : row.target_id ? String(row.target_id) : '';
        if (reqId && !map.has(reqId)) map.set(reqId, row.details || {});
        continue;
      }
      if (row.action === 'REFUND_STATUS') {
        const reqId = row.details?.refundLogId ? String(row.details.refundLogId) : row.target_id ? String(row.target_id) : '';
        if (reqId && !map.has(reqId)) map.set(reqId, row.details || {});
        continue;
      }
      if (row.action === 'REFUND_REQUEST') reqs.push(row);
    }
    return { requests: reqs, workflowByRequestId: map };
  }, [refundLogs]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (requests || []).filter((r: any) => {
      const d = r.details || {};
      const st = String(workflowByRequestId.get(String(r.id))?.status || d.status || 'open');
      if (status !== 'all' && st !== status) return false;
      if (!query) return true;
      const hay = `${d.eventTitle || ''} ${d.eventId || ''} ${d.rsvpId || ''} ${d.reason || ''} ${d.note || ''} ${d.requester?.email || ''}`.toLowerCase();
      return hay.includes(query);
    });
  }, [q, requests, status, workflowByRequestId]);

  const updateMutation = useMutation({
    mutationFn: async ({ refundLogId, status, amount, note }: { refundLogId: string; status: string; amount?: string; note?: string }) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/refunds/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          refundLogId,
          status,
          amount: amount ? Number(amount) : null,
          currency: 'CZK',
          note: note || '',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refund_logs'] });
      showToast('Uloženo', 'success');
      setEditingId(null);
      setAmount('');
      setNote('');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const startEdit = (id: string, next: 'open' | 'approved' | 'denied' | 'paid') => {
    setEditingId(id);
    setEditingStatus(next);
    setAmount('');
    setNote('');
  };

  const submitEdit = () => {
    if (!editingId) return;
    if (editingStatus === 'paid') {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        showToast('Zadejte částku', 'error');
        return;
      }
    }
    updateMutation.mutate({ refundLogId: editingId, status: editingStatus, amount, note });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <AdminModuleHeader title={dict?.admin?.tabRefunds || 'Refundy'} description="Politika refundů a žádosti." />

      <AdminPanel className="p-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Refund politika</div>
          <button
            type="button"
            onClick={() => savePolicyMutation.mutate()}
            disabled={savePolicyMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {savePolicyMutation.isPending ? <InlinePulse className="bg-white/80" size={12} /> : <Save size={16} />}
            Uložit
          </button>
        </div>
        <textarea
          value={policyDraft}
          onChange={(e) => setPolicyDraft(e.target.value)}
          rows={6}
          className="w-full focus:ring-2 focus:ring-green-500 transition resize-none"
          placeholder="Popište pravidla refundu…"
        />
        {policyLoading && <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-300">Načítání…</div>}
      </AdminPanel>

      <AdminPanel className="p-8">
        <div className="grid md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-7 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat…"
              className="w-full pl-11 focus:ring-2 focus:ring-green-500 transition"
            />
          </div>
          <div className="md:col-span-5 flex items-center gap-2">
            {(['open', 'approved', 'denied', 'paid', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex-1 px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  status === s ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {s === 'open' ? 'Otevřené' : s === 'approved' ? 'Schválené' : s === 'denied' ? 'Zamítnuté' : s === 'paid' ? 'Vyplacené' : 'Vše'}
              </button>
            ))}
          </div>
        </div>
      </AdminPanel>

      <AdminPanel className="p-6 overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10">
            <AdminEmptyState icon={RefreshCcw} title="Žádné žádosti" description="Pro zobrazení změň filtr stavu nebo vyhledávání." />
          </div>
        ) : (
          <div className="space-y-3">
            {rows.slice(0, 200).map((r: any) => {
              const d = r.details || {};
              const wf = workflowByRequestId.get(String(r.id)) || {};
              const st = String(wf?.status || d.status || 'open');
              const stLabel = st === 'approved' ? 'approved' : st === 'denied' ? 'denied' : st === 'paid' ? 'paid' : 'open';
              const pill =
                stLabel === 'paid'
                  ? 'bg-green-100 text-green-700'
                  : stLabel === 'approved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : stLabel === 'denied'
                      ? 'bg-stone-200 text-stone-700'
                      : 'bg-amber-100 text-amber-700';
              return (
                <div key={r.id} className="p-6 bg-stone-50 rounded-[2rem] border border-stone-100">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                        {d.eventTitle || 'Akce'} • RSVP {d.rsvpId || r.target_id}
                      </div>
                      <div className="text-lg font-black text-stone-900">{d.reason || '—'}</div>
                      {d.note && <div className="mt-2 text-sm font-medium text-stone-600 whitespace-pre-line">{String(d.note)}</div>}
                      <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-stone-300 flex flex-wrap items-center gap-3">
                        <span>{r.created_at ? new Date(r.created_at).toLocaleString('cs-CZ') : '—'}</span>
                        {d.requester?.email && (
                          <a className="inline-flex items-center gap-2 hover:text-green-700 transition" href={`mailto:${d.requester.email}`}>
                            <Mail size={12} /> {d.requester.email}
                          </a>
                        )}
                        <span className={`px-2 py-0.5 rounded-full ${pill}`}>
                          {st}
                        </span>
                        {wf?.amount != null && wf?.amount !== '' && (
                          <span className="px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700">
                            {String(wf.amount)} {String(wf.currency || 'CZK')}
                          </span>
                        )}
                      </div>
                      {wf?.note && <div className="mt-2 text-sm font-medium text-stone-600 whitespace-pre-line">{String(wf.note)}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editingId === r.id ? (
                        <div className="bg-white border border-stone-200 rounded-2xl p-4 w-full md:w-[360px] space-y-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                            {editingStatus === 'approved'
                              ? 'Schválit'
                              : editingStatus === 'denied'
                                ? 'Zamítnout'
                                : editingStatus === 'paid'
                                  ? 'Označit vyplaceno'
                                  : 'Otevřít'}
                          </div>
                          {editingStatus === 'paid' && (
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Částka (CZK)</div>
                              <input
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                                inputMode="decimal"
                                placeholder="0"
                              />
                            </div>
                          )}
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Poznámka</div>
                            <input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                              placeholder="Volitelné"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={submitEdit}
                              disabled={updateMutation.isPending}
                              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                            >
                              {updateMutation.isPending ? <InlinePulse className="bg-white/80" size={12} /> : <CheckCircle size={16} />}
                              Potvrdit
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              disabled={updateMutation.isPending}
                              className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ) : st !== 'paid' ? (
                        <button
                          type="button"
                          onClick={() => startEdit(r.id, 'approved')}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                        >
                          <CheckCircle size={16} />
                          Schválit
                        </button>
                      ) : null}
                      {editingId !== r.id && st !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => startEdit(r.id, 'denied')}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                        >
                          <X size={16} />
                          Zamítnout
                        </button>
                      )}
                      {editingId !== r.id && st === 'approved' && (
                        <button
                          type="button"
                          onClick={() => startEdit(r.id, 'paid')}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                        >
                          <RefreshCcw size={16} />
                          Vyplatit
                        </button>
                      )}
                      {editingId !== r.id && (st === 'denied' || st === 'paid') && (
                        <button
                          type="button"
                          onClick={() => startEdit(r.id, 'open')}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                        >
                          <RefreshCcw size={16} />
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
      </AdminPanel>
    </div>
  );
}
