'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Tag, Trash2, Download, Edit3, X } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { normalizePromoCode } from '@/lib/promo/rules';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';
import AdminEmptyState from './ui/AdminEmptyState';

type Rule = {
  code: string;
  title?: string;
  active: boolean;
  mode?: 'per_rsvp' | 'per_attendee';
  discountAmount?: number | null;
  discountPercentage?: number | null;
  maxUses?: number | null;
  maxUsesPerEmail?: number | null;
  eventIds?: string[];
  whitelistEmails?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  note?: string;
};

export default function PromoRulesTab({ dict }: { dict: any }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    code: '',
    title: '',
    active: true,
    mode: 'per_rsvp' as 'per_rsvp' | 'per_attendee',
    discountAmount: '',
    discountPercentage: '',
    maxUses: '',
    maxUsesPerEmail: '',
    eventIdsCsv: '',
    whitelistEmailsCsv: '',
    startsAt: '',
    endsAt: '',
    note: '',
  });

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Unauthorized');
    return token;
  };

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['promo_rules'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/admin/promo/rules', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return Array.isArray(json.rules) ? json.rules : [];
    },
  });

  const { data: uses = [] } = useQuery({
    queryKey: ['promo_uses'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/admin/promo/uses?limit=2000', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return Array.isArray(json.rows) ? json.rows : [];
    },
  });

  const usageByCode = useMemo(() => {
    const map = new Map<string, { used: number; lastAt: string }>();
    for (const row of uses as any[]) {
      const code = normalizePromoCode(String(row.target_id || row.details?.code || ''));
      if (!code) continue;
      const cur = map.get(code) || { used: 0, lastAt: String(row.created_at || '') };
      const n = Number(row?.details?.consumed ?? 1);
      cur.used += Number.isFinite(n) && n > 0 ? n : 1;
      if (row.created_at && (!cur.lastAt || new Date(row.created_at) > new Date(cur.lastAt))) cur.lastAt = String(row.created_at);
      map.set(code, cur);
    }
    return map;
  }, [uses]);

  const normalizedRules: Rule[] = useMemo(() => {
    const map = new Map<string, Rule>();
    for (const r of rules as any[]) {
      const code = normalizePromoCode(String(r?.code || ''));
      if (!code || map.has(code)) continue;
      map.set(code, {
        code,
        title: r?.title ? String(r.title).trim() : '',
        active: !!r?.active,
        discountAmount: r?.discountAmount == null || r?.discountAmount === '' ? null : Number(r.discountAmount),
        discountPercentage: r?.discountPercentage == null || r?.discountPercentage === '' ? null : Number(r.discountPercentage),
        maxUses: r?.maxUses == null || r?.maxUses === '' ? null : Number(r.maxUses),
        maxUsesPerEmail: r?.maxUsesPerEmail == null || r?.maxUsesPerEmail === '' ? null : Number(r.maxUsesPerEmail),
        mode: r?.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp',
        eventIds: Array.isArray(r?.eventIds) ? r.eventIds.map((x: any) => String(x)).filter(Boolean) : [],
        whitelistEmails: Array.isArray(r?.whitelistEmails) ? r.whitelistEmails.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean) : [],
        startsAt: r?.startsAt ? String(r.startsAt) : null,
        endsAt: r?.endsAt ? String(r.endsAt) : null,
        note: r?.note ? String(r.note).trim() : '',
      });
    }
    return Array.from(map.values());
  }, [rules]);

  const saveMutation = useMutation({
    mutationFn: async (nextRules: Rule[]) => {
      const token = await getToken();
      const res = await fetch('/api/admin/promo/rules/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rules: nextRules }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo_rules'] });
      showToast('Uloženo', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const resetForm = () => {
    setEditingCode(null);
    setNewRule({
      code: '',
      title: '',
      active: true,
      mode: 'per_rsvp',
      discountAmount: '',
      discountPercentage: '',
      maxUses: '',
      maxUsesPerEmail: '',
      eventIdsCsv: '',
      whitelistEmailsCsv: '',
      startsAt: '',
      endsAt: '',
      note: '',
    });
  };

  const startEdit = (r: Rule) => {
    setEditingCode(r.code);
    setNewRule({
      code: r.code,
      title: r.title || '',
      active: !!r.active,
      mode: r.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp',
      discountAmount: r.discountAmount != null ? String(r.discountAmount) : '',
      discountPercentage: r.discountPercentage != null ? String(r.discountPercentage) : '',
      maxUses: r.maxUses != null ? String(r.maxUses) : '',
      maxUsesPerEmail: r.maxUsesPerEmail != null ? String(r.maxUsesPerEmail) : '',
      eventIdsCsv: (r.eventIds || []).join(','),
      whitelistEmailsCsv: (r.whitelistEmails || []).join(','),
      startsAt: r.startsAt || '',
      endsAt: r.endsAt || '',
      note: r.note || '',
    });
  };

  const add = () => {
    const code = normalizePromoCode(newRule.code);
    if (!code) return;
    const eventIds = newRule.eventIdsCsv
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    const whitelistEmails = newRule.whitelistEmailsCsv
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

    const maxUses = newRule.maxUses ? Number(newRule.maxUses) : null;
    const maxUsesPerEmail = newRule.maxUsesPerEmail ? Number(newRule.maxUsesPerEmail) : null;
    const discountAmount = newRule.discountAmount ? Number(newRule.discountAmount) : null;
    const discountPercentage = newRule.discountPercentage ? Number(newRule.discountPercentage) : null;

    const next: Rule[] = [
      {
        code,
        title: newRule.title.trim(),
        active: !!newRule.active,
        mode: newRule.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp',
        discountAmount: Number.isFinite(discountAmount) && discountAmount! >= 0 ? discountAmount : null,
        discountPercentage: Number.isFinite(discountPercentage) && discountPercentage! >= 0 && discountPercentage! <= 100 ? discountPercentage : null,
        maxUses: Number.isFinite(maxUses) && maxUses! >= 1 ? Math.floor(maxUses!) : null,
        maxUsesPerEmail: Number.isFinite(maxUsesPerEmail) && maxUsesPerEmail! >= 1 ? Math.floor(maxUsesPerEmail!) : null,
        eventIds,
        whitelistEmails,
        startsAt: newRule.startsAt || null,
        endsAt: newRule.endsAt || null,
        note: newRule.note.trim(),
      },
      ...normalizedRules.filter((r) => r.code !== code),
    ];

    saveMutation.mutate(next);
    resetForm();
  };

  const toggleActive = (code: string) => {
    const next = normalizedRules.map((r) => (r.code === code ? { ...r, active: !r.active } : r));
    saveMutation.mutate(next);
  };

  const remove = (code: string) => {
    const next = normalizedRules.filter((r) => r.code !== code);
    saveMutation.mutate(next);
  };

  const downloadUsesCsv = () => {
    const rows = (uses as any[]).map((u: any) => {
      const d = u.details || {};
      return {
        created_at: String(u.created_at || ''),
        code: normalizePromoCode(String(u.target_id || d.code || '')),
        email: String(d.email || ''),
        event_id: String(d.eventId || ''),
        rsvp_id: String(d.rsvpId || ''),
        status: String(d.status || ''),
        ip: String(d.ip || ''),
        mode: String(d.mode || ''),
        consumed: d.consumed != null ? String(d.consumed) : '',
      };
    });
    const header = Object.keys(rows[0] || { created_at: '' });
    const esc = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [header.join(','), ...rows.map((r: any) => header.map((h) => esc(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `promo_use_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <AdminModuleHeader
        title={dict?.admin?.tabPromoRules || 'Promo kódy'}
        description="Validace a limity použití promo kódů."
        actions={
          <button
            type="button"
            onClick={downloadUsesCsv}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            <Download size={16} />
            Export použití
          </button>
        }
      />

      <AdminPanel className="p-8">
        <div className="grid md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Kód</div>
            <input
              value={newRule.code}
              onChange={(e) => setNewRule((p) => ({ ...p, code: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="PUPEN2026"
            />
          </div>
          <div className="md:col-span-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Název</div>
            <input
              value={newRule.title}
              onChange={(e) => setNewRule((p) => ({ ...p, title: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="Např. Partner"
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Režim</div>
            <select
              value={newRule.mode}
              onChange={(e) => setNewRule((p) => ({ ...p, mode: e.target.value as any }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
            >
              <option value="per_rsvp">per RSVP</option>
              <option value="per_attendee">per attendee</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Sleva (Kč)</div>
            <input
              value={newRule.discountAmount}
              onChange={(e) => setNewRule((p) => ({ ...p, discountAmount: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="např. 100"
              inputMode="numeric"
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Sleva (%)</div>
            <input
              value={newRule.discountPercentage}
              onChange={(e) => setNewRule((p) => ({ ...p, discountPercentage: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="např. 20"
              inputMode="numeric"
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Max použití</div>
            <input
              value={newRule.maxUses}
              onChange={(e) => setNewRule((p) => ({ ...p, maxUses: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="např. 50"
              inputMode="numeric"
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Max / email</div>
            <input
              value={newRule.maxUsesPerEmail}
              onChange={(e) => setNewRule((p) => ({ ...p, maxUsesPerEmail: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="např. 1"
              inputMode="numeric"
            />
          </div>
          <div className="md:col-span-12 flex justify-end gap-2">
            <button
              type="button"
              onClick={add}
              disabled={saveMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              {saveMutation.isPending ? <InlinePulse className="bg-white/80" size={12} /> : <Plus size={16} />}
              {editingCode ? 'Uložit' : 'Přidat'}
            </button>
            {editingCode && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saveMutation.isPending}
                className="inline-flex items-center justify-center rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="md:col-span-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Event ID (csv, volitelné)</div>
            <input
              value={newRule.eventIdsCsv}
              onChange={(e) => setNewRule((p) => ({ ...p, eventIdsCsv: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="id1,id2"
            />
          </div>
          <div className="md:col-span-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Whitelist e-maily (csv, volitelné)</div>
            <input
              value={newRule.whitelistEmailsCsv}
              onChange={(e) => setNewRule((p) => ({ ...p, whitelistEmailsCsv: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="a@b.cz,c@d.cz"
            />
          </div>
          <div className="md:col-span-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Start (ISO)</div>
            <input
              value={newRule.startsAt}
              onChange={(e) => setNewRule((p) => ({ ...p, startsAt: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="2026-01-01T00:00:00Z"
            />
          </div>
          <div className="md:col-span-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">End (ISO)</div>
            <input
              value={newRule.endsAt}
              onChange={(e) => setNewRule((p) => ({ ...p, endsAt: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="2026-02-01T00:00:00Z"
            />
          </div>
          <div className="md:col-span-12">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Poznámka</div>
            <input
              value={newRule.note}
              onChange={(e) => setNewRule((p) => ({ ...p, note: e.target.value }))}
              className="w-full focus:ring-2 focus:ring-green-500 transition"
              placeholder="Např. interní důvod / partner"
            />
          </div>
        </div>
      </AdminPanel>

      <AdminPanel className="p-6 overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : normalizedRules.length === 0 ? (
          <div className="py-10">
            <AdminEmptyState icon={Tag} title="Žádné promo kódy" description="Přidej první pravidlo nahoře." />
          </div>
        ) : (
          <div className="space-y-3">
            {normalizedRules.map((r) => {
              const usage = usageByCode.get(r.code);
              const used = usage?.used || 0;
              const limit = r.maxUses ? Number(r.maxUses) : null;
              const hint = limit ? `${used}/${limit}` : `${used}`;
              return (
                <div key={r.code} className="p-6 bg-stone-50 rounded-[2rem] border border-stone-100 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="font-black text-stone-900">{r.code}</div>
                      <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${r.active ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-700'}`}>
                        {r.active ? 'active' : 'inactive'}
                      </span>
                      <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-stone-200 text-stone-700">
                        used {hint}
                      </span>
                      <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-stone-200 text-stone-700">
                        {r.mode === 'per_attendee' ? 'per attendee' : 'per rsvp'}
                      </span>
                    </div>
                    {r.title && <div className="mt-1 text-sm font-bold text-stone-700">{r.title}</div>}
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                      {r.discountAmount ? `sleva: ${r.discountAmount} Kč` : ''}
                      {r.discountPercentage ? ` • sleva: ${r.discountPercentage} %` : ''}
                      {r.eventIds && r.eventIds.length > 0 ? ` • events: ${r.eventIds.join(', ')}` : ' • events: all'}
                      {r.maxUsesPerEmail ? ` • per email: ${r.maxUsesPerEmail}` : ''}
                      {r.whitelistEmails && r.whitelistEmails.length > 0 ? ` • whitelist: ${r.whitelistEmails.length}` : ''}
                      {r.startsAt ? ` • start: ${r.startsAt}` : ''}
                      {r.endsAt ? ` • end: ${r.endsAt}` : ''}
                      {usage?.lastAt ? ` • last: ${new Date(usage.lastAt).toLocaleString('cs-CZ')}` : ''}
                    </div>
                    {r.note && <div className="mt-2 text-sm font-medium text-stone-600">{r.note}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      disabled={saveMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(r.code)}
                      disabled={saveMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      <Save size={16} />
                      Toggle
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r.code)}
                      disabled={saveMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      Smazat
                    </button>
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
