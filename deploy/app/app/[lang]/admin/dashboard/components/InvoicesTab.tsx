'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Search, CheckCircle, RefreshCcw, Save } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import CopyButton from '@/app/components/CopyButton';
import { useToast } from '@/app/context/ToastContext';

function toCsv(rows: any[]) {
  const escape = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const header = ['created_at', 'status', 'status_note', 'rsvp_id', 'event_title', 'email', 'buyer_type', 'buyer_name', 'buyer_address', 'ico', 'dic', 'note'];
  const lines = [header.join(',')].concat(
    rows.map((r) =>
      header
        .map((k) => {
          const v =
            k === 'rsvp_id'
              ? r.target_id
              : k === 'created_at'
                ? r.created_at
                : k === 'status'
                  ? r.status
                  : k === 'status_note'
                    ? r.status_note
                    : (r.details?.[k] ?? '');
          return escape(v);
        })
        .join(',')
    )
  );
  return lines.join('\n');
}

export default function InvoicesTab() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<'open' | 'done' | 'all'>('open');
  const [editingRsvpId, setEditingRsvpId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice_requests'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/invoices/logs?limit=800', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return {
        requests: Array.isArray(json.requests) ? json.requests : [],
        statuses: Array.isArray(json.statuses) ? json.statuses : [],
      };
    },
  });

  const statusByRsvpId = useMemo(() => {
    const m = new Map<string, { status: 'open' | 'done'; note: string }>();
    const rows = (data as any)?.statuses || [];
    for (const r of rows) {
      const tid = String(r.target_id || '').trim();
      if (!tid || m.has(tid)) continue;
      const st = String(r.details?.status || '').trim();
      m.set(tid, { status: st === 'done' ? 'done' : 'open', note: String(r.details?.note || '') });
    }
    return m;
  }, [data]);

  const requests = useMemo(() => {
    return ((data as any)?.requests || []) as any[];
  }, [data]);

  const filtered = useMemo(() => {
    const rows = requests || [];
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r: any) => {
      const d = r.details || {};
      return (
        String(r.target_id || '').toLowerCase().includes(query) ||
        String(d.eventTitle || '').toLowerCase().includes(query) ||
        String(d.email || '').toLowerCase().includes(query) ||
        String(d.buyerName || '').toLowerCase().includes(query) ||
        String(d.buyerAddress || '').toLowerCase().includes(query)
      );
    });
  }, [requests, q]);

  const rows = useMemo(() => {
    const base = filtered.map((r: any) => {
      const tid = String(r.target_id || '').trim();
      const st = statusByRsvpId.get(tid) || { status: 'open' as const, note: '' };
      return { ...r, __status: st.status, __status_note: st.note };
    });
    if (filterStatus === 'all') return base;
    return base.filter((r: any) => r.__status === filterStatus);
  }, [filtered, filterStatus, statusByRsvpId]);

  const updateMutation = useMutation({
    mutationFn: async ({ rsvpId, status, note }: { rsvpId: string; status: 'open' | 'done'; note: string }) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/invoices/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rsvpId, status, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoice_requests'] });
      showToast('Uloženo', 'success');
      setEditingRsvpId(null);
      setNote('');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const downloadCsv = () => {
    const csv = toCsv(
      rows.map((r: any) => ({
        created_at: r.created_at,
        target_id: r.target_id,
        status: r.__status,
        status_note: r.__status_note,
        details: {
          event_title: r.details?.eventTitle,
          email: r.details?.email,
          buyer_type: r.details?.buyerType,
          buyer_name: r.details?.buyerName,
          buyer_address: r.details?.buyerAddress,
          ico: r.details?.ico,
          dic: r.details?.dic,
          note: r.details?.note,
        },
      }))
    );

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pupen-invoice-requests.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <FileText className="text-green-600" />
              Faktury (žádosti)
            </h2>
            <p className="text-stone-500 font-medium">Přehled žádostí o fakturu z registrací na akce.</p>
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!filtered.length}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        <div className="mt-8 grid lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat…"
              className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
            />
          </div>
          <div className="lg:col-span-6 flex gap-3 justify-start lg:justify-end">
            {(['open', 'done', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                  filterStatus === s ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {s === 'open' ? 'Open' : s === 'done' ? 'Done' : 'All'}
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
        ) : error ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            Nelze načíst data.
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            Zatím žádné žádosti.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  <th className="py-4 px-4">Datum</th>
                  <th className="py-4 px-4">Stav</th>
                  <th className="py-4 px-4">Akce</th>
                  <th className="py-4 px-4">Kontakt</th>
                  <th className="py-4 px-4">Odběratel</th>
                  <th className="py-4 px-4">RSVP</th>
                  <th className="py-4 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r: any) => (
                  <tr key={r.id} className="border-t border-stone-100 hover:bg-stone-50 transition">
                    <td className="py-4 px-4 text-sm font-bold text-stone-700">
                      {r.created_at ? new Date(r.created_at).toLocaleString('cs-CZ') : '—'}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                            r.__status === 'done' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {r.__status === 'done' ? 'Done' : 'Open'}
                        </span>
                        {r.__status_note ? <span className="text-xs text-stone-500 font-medium truncate max-w-[220px]">{r.__status_note}</span> : null}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-stone-900">{r.details?.eventTitle || '—'}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                        {r.details?.buyerType === 'company' ? 'Firma' : 'Osoba'}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-stone-900">{r.details?.email || '—'}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-stone-900">{r.details?.buyerName || '—'}</div>
                      <div className="text-sm text-stone-500 font-medium whitespace-pre-line">
                        {r.details?.buyerAddress || ''}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="font-black tracking-widest text-stone-900">{r.target_id}</div>
                        <CopyButton
                          value={String(r.target_id || '')}
                          idleLabel="Kopírovat"
                          copiedLabel="OK"
                          className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {editingRsvpId === String(r.target_id || '') ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Poznámka…"
                            className="w-52 bg-white border border-stone-200 rounded-xl px-4 py-3 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                          />
                          <button
                            type="button"
                            disabled={updateMutation.isPending}
                            onClick={() =>
                              updateMutation.mutate({
                                rsvpId: String(r.target_id || ''),
                                status: r.__status === 'done' ? 'open' : 'done',
                                note,
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {updateMutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />}
                            Uložit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRsvpId(null);
                              setNote('');
                            }}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                          >
                            <RefreshCcw size={16} />
                            Zrušit
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const rid = String(r.target_id || '');
                            setEditingRsvpId(rid);
                            setNote(String(r.__status_note || ''));
                          }}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                        >
                          <CheckCircle size={16} />
                          {r.__status === 'done' ? 'Znovu otevřít' : 'Označit vyřešeno'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
