'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Search } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import CopyButton from '@/app/components/CopyButton';

function toCsv(rows: any[]) {
  const escape = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const header = ['created_at', 'rsvp_id', 'event_title', 'email', 'buyer_type', 'buyer_name', 'buyer_address', 'ico', 'dic', 'note'];
  const lines = [header.join(',')].concat(
    rows.map((r) =>
      header
        .map((k) => {
          const v = k === 'rsvp_id' ? r.target_id : k === 'created_at' ? r.created_at : (r.details?.[k] ?? '');
          return escape(v);
        })
        .join(',')
    )
  );
  return lines.join('\n');
}

export default function InvoicesTab() {
  const [q, setQ] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice_requests'],
    queryFn: async () => {
      const res = await supabase
        .from('admin_logs')
        .select('id, created_at, target_id, action, details')
        .ilike('action', 'Žádost o fakturu:%')
        .order('created_at', { ascending: false })
        .limit(300);
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  const filtered = useMemo(() => {
    const rows = data || [];
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
  }, [data, q]);

  const downloadCsv = () => {
    const csv = toCsv(
      filtered.map((r: any) => ({
        created_at: r.created_at,
        target_id: r.target_id,
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

        <div className="mt-8 max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledat…"
            className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
          />
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
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            Zatím žádné žádosti.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  <th className="py-4 px-4">Datum</th>
                  <th className="py-4 px-4">Akce</th>
                  <th className="py-4 px-4">Kontakt</th>
                  <th className="py-4 px-4">Odběratel</th>
                  <th className="py-4 px-4">RSVP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((r: any) => (
                  <tr key={r.id} className="border-t border-stone-100 hover:bg-stone-50 transition">
                    <td className="py-4 px-4 text-sm font-bold text-stone-700">
                      {r.created_at ? new Date(r.created_at).toLocaleString('cs-CZ') : '—'}
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
