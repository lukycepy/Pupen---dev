'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Receipt, Search, RefreshCcw, Save, FilePlus2, ArrowRightLeft, XCircle, BadgeCheck, Mail } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import ConfirmModal from '@/app/components/ConfirmModal';
import { useToast } from '@/app/context/ToastContext';
import { billingInvoiceCreateSchema, type BillingInvoiceStatus, type BillingInvoiceType } from '@/lib/validations/billing';
import type { BillingInvoiceDto, BillingInvoiceItemDto } from '@/lib/billing/invoices';
import { useParams } from 'next/navigation';

type FormValues = {
  invoice: {
    type?: BillingInvoiceType;
    currency?: string;
    buyerName?: string;
    buyerAddress?: string;
    buyerEmail?: string;
    ico?: string;
    dic?: string;
    vs?: string;
    note?: string;
    issueDate?: string;
    dueDate?: string;
    sourceDepositInvoiceId?: string;
    creditedInvoiceId?: string;
  };
  items: Array<{ position?: number; title: string; quantity: any; unitPrice: any }>;
};

const PAGE_SIZE = 50;

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: currency || 'CZK', maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${value || 0} ${currency || 'CZK'}`;
  }
}

function statusBadge(status: BillingInvoiceStatus) {
  if (status === 'paid') return 'bg-green-100 text-green-700';
  if (status === 'partially_paid') return 'bg-amber-100 text-amber-700';
  if (status === 'issued' || status === 'sent') return 'bg-blue-100 text-blue-700';
  if (status === 'cancelled') return 'bg-stone-200 text-stone-700';
  if (status === 'credited') return 'bg-purple-100 text-purple-700';
  return 'bg-amber-100 text-amber-700';
}

function typeBadge(type: BillingInvoiceType) {
  if (type === 'deposit') return 'bg-amber-100 text-amber-700';
  if (type === 'credit_note') return 'bg-purple-100 text-purple-700';
  return 'bg-stone-100 text-stone-700';
}

function normalizeItems(items: BillingInvoiceItemDto[]) {
  const rows = Array.isArray(items) ? items : [];
  return rows
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((it, idx) => ({
      position: typeof it.position === 'number' ? it.position : idx + 1,
      title: String(it.title || ''),
      quantity: it.quantity ?? 1,
      unitPrice: it.unitPrice ?? 0,
    }));
}

export default function BillingTab({ dict }: any) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const params = useParams();
  const uiLang = (params?.lang as string) === 'en' ? 'en' : 'cs';

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | BillingInvoiceStatus>('all');
  const [type, setType] = useState<'all' | BillingInvoiceType>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(billingInvoiceCreateSchema as any),
    defaultValues: {
      invoice: { type: 'invoice', currency: 'CZK' },
      items: [{ position: 1, title: '', quantity: 1, unitPrice: 0 }],
    },
    mode: 'onSubmit',
  });

  const { register, handleSubmit, reset, formState } = form;
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'items' });
  const invoiceWatch = useWatch({ control: form.control, name: 'invoice' });
  const itemsWatch = useWatch({ control: form.control, name: 'items' });

  const computedTotal = useMemo(() => {
    const rows = Array.isArray(itemsWatch) ? itemsWatch : [];
    return rows.reduce((acc, it) => acc + Number(it?.quantity || 0) * Number(it?.unitPrice || 0), 0);
  }, [itemsWatch]);

  const listQuery = useQuery({
    queryKey: ['billing_invoices', q, status, type, from, to, page],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      if (q.trim()) params.set('q', q.trim());
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await fetch(`/api/admin/billing/invoices?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return { rows: (json?.rows || []) as BillingInvoiceDto[], count: json?.count as number | null };
    },
  });

  const detailQuery = useQuery({
    queryKey: ['billing_invoice_detail', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const res = await fetch(`/api/admin/billing/invoices/${selectedId}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return { invoice: json?.invoice as BillingInvoiceDto, items: (json?.items || []) as BillingInvoiceItemDto[] };
    },
  });

  const selectedInvoice = detailQuery.data?.invoice || null;
  const selectedItems = useMemo(() => detailQuery.data?.items || [], [detailQuery.data?.items]);
  const isEditable = selectedInvoice ? selectedInvoice.status === 'draft' : true;

  useEffect(() => {
    if (!selectedId) {
      reset({ invoice: { type: 'invoice', currency: 'CZK', vs: '' }, items: [{ position: 1, title: '', quantity: 1, unitPrice: 0 }] });
      return;
    }
    if (selectedInvoice) {
      reset({
        invoice: {
          type: selectedInvoice.type,
          currency: selectedInvoice.currency,
          buyerName: selectedInvoice.buyerName || '',
          buyerAddress: selectedInvoice.buyerAddress || '',
          buyerEmail: selectedInvoice.buyerEmail || '',
          ico: selectedInvoice.ico || '',
          dic: selectedInvoice.dic || '',
          vs: selectedInvoice.vs || '',
          note: selectedInvoice.note || '',
          issueDate: selectedInvoice.issueDate || '',
          dueDate: selectedInvoice.dueDate || '',
          sourceDepositInvoiceId: selectedInvoice.sourceDepositInvoiceId || '',
          creditedInvoiceId: selectedInvoice.creditedInvoiceId || '',
        },
        items: normalizeItems(selectedItems),
      });
      if (selectedItems.length === 0) {
        replace([{ position: 1, title: '', quantity: 1, unitPrice: 0 }]);
      }
    }
  }, [replace, reset, selectedId, selectedInvoice, selectedItems]);

  const createMutation = useMutation({
    mutationFn: async (payload: FormValues) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const res = await fetch('/api/admin/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json?.invoice as BillingInvoiceDto;
    },
    onSuccess: async (inv) => {
      await qc.invalidateQueries({ queryKey: ['billing_invoices'] });
      setSelectedId(inv.id);
      showToast('Uloženo', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: FormValues) => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const res = await fetch(`/api/admin/billing/invoices/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return { invoice: json?.invoice as BillingInvoiceDto, items: (json?.items || []) as BillingInvoiceItemDto[] };
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['billing_invoices'] }),
        qc.invalidateQueries({ queryKey: ['billing_invoice_detail', selectedId] }),
      ]);
      showToast('Uloženo', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/billing/invoices/${selectedId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toStatus: 'issued' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json?.invoice as BillingInvoiceDto;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['billing_invoices'] }),
        qc.invalidateQueries({ queryKey: ['billing_invoice_detail', selectedId] }),
      ]);
      showToast('Vystaveno', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/billing/invoices/${selectedId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toStatus: 'sent', lang: uiLang }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json?.invoice as BillingInvoiceDto;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['billing_invoices'] }),
        qc.invalidateQueries({ queryKey: ['billing_invoice_detail', selectedId] }),
      ]);
      showToast('E-mail zařazen do fronty', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/billing/invoices/${selectedId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toStatus: 'cancelled' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json?.invoice as BillingInvoiceDto;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['billing_invoices'] }),
        qc.invalidateQueries({ queryKey: ['billing_invoice_detail', selectedId] }),
      ]);
      showToast('Storno provedeno', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const creditNoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/billing/invoices/${selectedId}/credit-note`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return { creditNote: json?.creditNote as BillingInvoiceDto, items: (json?.items || []) as BillingInvoiceItemDto[] };
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['billing_invoices'] });
      setSelectedId(data.creditNote.id);
      showToast('Dobropis vytvořen', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const transferDepositMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/billing/invoices/${selectedId}/transfer-deposit`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return { invoice: json?.invoice as BillingInvoiceDto, items: (json?.items || []) as BillingInvoiceItemDto[] };
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['billing_invoices'] });
      setSelectedId(data.invoice.id);
      showToast('Převod zálohy vytvořen', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const submit = handleSubmit(async (values) => {
    if (!isEditable) return;
    if (selectedId) updateMutation.mutate(values);
    else createMutation.mutate(values);
  });

  const rows = listQuery.data?.rows || [];
  const count = listQuery.data?.count;
  const canPrev = page > 0;
  const canNext = typeof count === 'number' ? (page + 1) * PAGE_SIZE < count : rows.length === PAGE_SIZE;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <Receipt className="text-green-600" />
              {dict?.admin?.tabBilling || 'Fakturace'}
            </h2>
            <p className="text-stone-500 font-medium">Vystavování a správa faktur (včetně dobropisů a záloh).</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              reset({ invoice: { type: 'invoice', currency: 'CZK', vs: '' }, items: [{ position: 1, title: '', quantity: 1, unitPrice: 0 }] });
            }}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            <FilePlus2 size={16} />
            Nová faktura
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 xl:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 sticky top-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Detail</div>
              <div className="text-xl font-black text-stone-900 truncate">
                {selectedInvoice?.number || (selectedInvoice ? 'Bez čísla' : 'Nová faktura')}
              </div>
              {selectedInvoice ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${statusBadge(selectedInvoice.status)}`}>
                    {selectedInvoice.status}
                  </span>
                  <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${typeBadge(selectedInvoice.type)}`}>
                    {selectedInvoice.type}
                  </span>
                </div>
              ) : null}
            </div>
            {selectedId ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400"
                title="Zavřít detail"
              >
                <XCircle size={20} />
              </button>
            ) : null}
          </div>

          {detailQuery.isLoading && selectedId ? (
            <div className="py-10 flex items-center justify-center">
              <InlinePulse className="bg-stone-200" size={18} />
            </div>
          ) : detailQuery.error ? (
            <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">Nelze načíst detail.</div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Typ</label>
                  <select
                    {...register('invoice.type')}
                    disabled={!isEditable}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                  >
                    <option value="invoice">Faktura</option>
                    <option value="deposit">Záloha</option>
                    <option value="credit_note">Dobropis</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Měna</label>
                  <input
                    {...register('invoice.currency')}
                    disabled={!isEditable}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Odběratel</label>
                <input
                  {...register('invoice.buyerName')}
                  disabled={!isEditable}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Adresa</label>
                <textarea
                  {...register('invoice.buyerAddress')}
                  disabled={!isEditable}
                  className="w-full min-h-[90px] bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">E-mail</label>
                  <input
                    {...register('invoice.buyerEmail')}
                    disabled={!isEditable}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">IČO</label>
                  <input
                    {...register('invoice.ico')}
                    disabled={!isEditable}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">DIČ</label>
                  <input
                    {...register('invoice.dic')}
                    disabled={!isEditable}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Datum vystavení</label>
                  <input
                    {...register('invoice.issueDate')}
                    type="date"
                    disabled={!isEditable}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Datum splatnosti</label>
                  <input
                    {...register('invoice.dueDate')}
                    type="date"
                    disabled={!isEditable}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">VS</label>
                <input
                  {...register('invoice.vs')}
                  disabled={!isEditable}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                />
                {selectedInvoice ? (
                  <div className="px-1 text-xs font-bold text-stone-500">
                    Uhrazeno: {formatMoney(selectedInvoice.paidAmount || 0, selectedInvoice.currency)} / {formatMoney(selectedInvoice.total || 0, selectedInvoice.currency)}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Poznámka</label>
                <textarea
                  {...register('invoice.note')}
                  disabled={!isEditable}
                  className="w-full min-h-[90px] bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                />
              </div>

              <div className="pt-4 border-t border-stone-100 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black uppercase tracking-widest text-stone-800">Položky</div>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => append({ position: fields.length + 1, title: '', quantity: 1, unitPrice: 0 })}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                  >
                    <Plus size={14} />
                    Přidat
                  </button>
                </div>

                <div className="space-y-3">
                  {fields.map((f, idx) => {
                    const qv = Number(itemsWatch?.[idx]?.quantity || 0);
                    const pv = Number(itemsWatch?.[idx]?.unitPrice || 0);
                    const lineTotal = qv * pv;
                    const hasErr = !!(formState.errors as any)?.items?.[idx];

                    return (
                      <div
                        key={f.id}
                        className={`rounded-[1.5rem] border p-4 ${hasErr ? 'border-red-200 bg-red-50/30' : 'border-stone-200 bg-white'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-3">
                            <input
                              {...register(`items.${idx}.title` as const)}
                              disabled={!isEditable}
                              placeholder="Název položky"
                              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                {...register(`items.${idx}.quantity` as const)}
                                disabled={!isEditable}
                                inputMode="decimal"
                                placeholder="Množství"
                                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                              />
                              <input
                                {...register(`items.${idx}.unitPrice` as const)}
                                disabled={!isEditable}
                                inputMode="decimal"
                                placeholder="Cena za ks"
                                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                              />
                            </div>
                            <div className="text-xs font-bold text-stone-500">
                              Celkem: {formatMoney(lineTotal, String(invoiceWatch?.currency || 'CZK'))}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!isEditable || fields.length <= 1}
                            onClick={() => remove(idx)}
                            className="p-2 rounded-xl border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 transition disabled:opacity-40"
                            title="Smazat položku"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 border border-stone-100 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Celkem</div>
                  <div className="text-lg font-black text-stone-900">{formatMoney(computedTotal, String(invoiceWatch?.currency || 'CZK'))}</div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={!isEditable || createMutation.isPending || updateMutation.isPending}
                  className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending || updateMutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />}
                  Uložit
                </button>

                {selectedInvoice?.status === 'draft' ? (
                  <button
                    type="button"
                    disabled={issueMutation.isPending}
                    onClick={() => issueMutation.mutate()}
                    className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {issueMutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <BadgeCheck size={16} />}
                    Vystavit / přidělit číslo
                  </button>
                ) : null}

                {selectedInvoice?.status === 'issued' && selectedInvoice?.buyerEmail ? (
                  <button
                    type="button"
                    disabled={sendMutation.isPending}
                    onClick={() => {
                      setConfirmConfig({
                        title: 'Odeslat e-mail s fakturou?',
                        message: `Zařadí se do fronty a odešle se přes cron. Příjemce: ${selectedInvoice.buyerEmail}`,
                        onConfirm: () => sendMutation.mutate(),
                      });
                      setConfirmOpen(true);
                    }}
                    className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sendMutation.isPending ? <InlinePulse className="bg-stone-200" size={14} /> : <Mail size={16} />}
                    Odeslat e‑mail ({uiLang.toUpperCase()})
                  </button>
                ) : null}

                {selectedId ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={cancelMutation.isPending || selectedInvoice?.status === 'cancelled'}
                      onClick={() => {
                        setConfirmConfig({
                          title: 'Storno faktury?',
                          message: 'Opravdu chcete provést storno? Tato operace změní stav na cancelled.',
                          onConfirm: () => cancelMutation.mutate(),
                        });
                        setConfirmOpen(true);
                      }}
                      className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <XCircle size={16} />
                      Storno
                    </button>

                    <button
                      type="button"
                      disabled={creditNoteMutation.isPending || selectedInvoice?.status === 'cancelled'}
                      onClick={() => {
                        setConfirmConfig({
                          title: 'Vytvořit dobropis?',
                          message: 'Vytvoří se nový dobropis a původní faktura se označí jako credited.',
                          onConfirm: () => creditNoteMutation.mutate(),
                        });
                        setConfirmOpen(true);
                      }}
                      className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <RefreshCcw size={16} />
                      Dobropis
                    </button>
                  </div>
                ) : null}

                {selectedInvoice?.type === 'deposit' ? (
                  <button
                    type="button"
                    disabled={transferDepositMutation.isPending}
                    onClick={() => {
                      setConfirmConfig({
                        title: 'Převod zálohy?',
                        message: 'Vytvoří se nová faktura se zápornou položkou odpovídající záloze a záloha se označí jako credited.',
                        onConfirm: () => transferDepositMutation.mutate(),
                      });
                      setConfirmOpen(true);
                    }}
                    className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft size={16} />
                    Převod zálohy
                  </button>
                ) : null}

                {!isEditable && selectedInvoice ? (
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 text-center">
                    Faktura není v draftu, formulář je jen pro čtení.
                  </div>
                ) : null}
              </div>
            </form>
          )}
        </div>

        <div className="lg:col-span-7 xl:col-span-8 bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
          <div className="mb-8 grid lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-5 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Hledat číslo / VS / e-mail / odběratel…"
                className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              />
            </div>

            <div className="lg:col-span-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Stav</div>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as any);
                  setPage(0);
                }}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
              >
                <option value="all">Vše</option>
                <option value="draft">draft</option>
                <option value="issued">issued</option>
                <option value="sent">sent</option>
                <option value="partially_paid">partially_paid</option>
                <option value="paid">paid</option>
                <option value="cancelled">cancelled</option>
                <option value="credited">credited</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Typ</div>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as any);
                  setPage(0);
                }}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
              >
                <option value="all">Vše</option>
                <option value="invoice">invoice</option>
                <option value="deposit">deposit</option>
                <option value="credit_note">credit_note</option>
              </select>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Od</div>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(0);
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Do</div>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(0);
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
            </div>
          </div>

          {listQuery.isLoading ? (
            <div className="py-16 flex items-center justify-center">
              <InlinePulse className="bg-stone-200" size={18} />
            </div>
          ) : listQuery.error ? (
            <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">Nelze načíst faktury.</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">Zatím žádné faktury.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                    <th className="py-4 px-4">Číslo</th>
                    <th className="py-4 px-4">Stav</th>
                    <th className="py-4 px-4">Typ</th>
                    <th className="py-4 px-4">Odběratel</th>
                    <th className="py-4 px-4 text-right">Celkem</th>
                    <th className="py-4 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const active = selectedId === r.id;
                    return (
                      <tr
                        key={r.id}
                        className={`border-t border-stone-100 transition cursor-pointer ${active ? 'bg-green-50/30' : 'hover:bg-stone-50'}`}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <td className="py-4 px-4">
                          <div className="font-black tracking-widest text-stone-900">{r.number || '—'}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString('cs-CZ') : ''}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${statusBadge(r.status)}`}>{r.status}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${typeBadge(r.type)}`}>{r.type}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-stone-900">{r.buyerName || '—'}</div>
                          <div className="text-xs text-stone-500 font-medium truncate max-w-[320px]">{r.buyerEmail || ''}</div>
                        </td>
                        <td className="py-4 px-4 text-right font-black text-stone-900">{formatMoney(r.total, r.currency)}</td>
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(r.id);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                          >
                            <RefreshCcw size={16} />
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-6 flex items-center justify-between gap-3">
            <div className="text-xs text-stone-500 font-bold">
              {typeof count === 'number' ? (
                <>
                  Zobrazeno {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} z {count}
                </>
              ) : (
                <>Zobrazeno {rows.length}</>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                Předchozí
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                Další
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          confirmConfig.onConfirm();
        }}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />
    </div>
  );
}
