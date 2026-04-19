'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import ConfirmModal from '@/app/components/ConfirmModal';
import { KeyRound, Plus, Save, Trash2, Eye, EyeOff, MapPin, Phone, Tag } from 'lucide-react';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import AdminPanel from './ui/AdminPanel';
import { tEnum } from '@/lib/i18n-enum';

type Item = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  contact: string | null;
  status: string;
  is_public: boolean;
};

export default function LostFoundTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const statusLabel = useCallback((v: any) => tEnum(dict, 'admin.lostFound.status', v), [dict]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/lost-found', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      setItems((json?.items || []) as Item[]);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => {
      const hay = `${i.title} ${i.description || ''} ${i.category || ''} ${i.location || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  const startNew = () => {
    setEditing({
      id: '',
      created_at: new Date().toISOString(),
      title: '',
      description: '',
      category: 'ISIC',
      location: '',
      contact: '',
      status: 'open',
      is_public: true,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!String(editing.title || '').trim()) {
      showToast('Vyplň název', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');

      if (!editing.id) {
        const res = await fetch('/api/admin/lost-found', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ item: editing }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Uložení selhalo');
      } else {
        const res = await fetch(`/api/admin/lost-found/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ patch: editing }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Uložení selhalo');
      }

      showToast('Uloženo', 'success');
      setEditing(null);
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (id: string) => {
    setModalConfig({
      title: 'Smazat položku?',
      message: 'Opravdu chceš položku smazat? Tato akce je nevratná.',
      onConfirm: async () => {
        setModalOpen(false);
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (!token) throw new Error('Nepřihlášen');
          const res = await fetch(`/api/admin/lost-found/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error || 'Smazání selhalo');
          showToast('Smazáno', 'success');
          await load();
        } catch (e: any) {
          showToast(e?.message || 'Chyba', 'error');
        }
      },
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <AdminModuleHeader
        title="Ztráty a nálezy"
        description="Rychlý feed pro ztracený ISIC, klíče a další věci."
        actions={
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat..."
              className="bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
            />
            <button
              type="button"
              onClick={startNew}
              className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
            >
              <Plus size={18} /> Přidat
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 xl:col-span-4">
          {editing ? (
            <AdminPanel className="p-8 rounded-[2.5rem] sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <div className="font-black text-stone-900 text-lg flex items-center gap-2">
                  <KeyRound className="text-green-600" size={18} /> {editing.id ? 'Upravit' : 'Nová položka'}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                >
                  Zrušit
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název</div>
                  <input
                    value={editing.title}
                    onChange={(e) => setEditing((p) => (p ? { ...p, title: e.target.value } : p))}
                    className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Popis</div>
                  <textarea
                    value={editing.description || ''}
                    onChange={(e) => setEditing((p) => (p ? { ...p, description: e.target.value } : p))}
                    rows={4}
                    className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</div>
                    <input
                      value={editing.category || ''}
                      onChange={(e) => setEditing((p) => (p ? { ...p, category: e.target.value } : p))}
                      className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Stav</div>
                    <select
                      value={editing.status}
                      onChange={(e) => setEditing((p) => (p ? { ...p, status: e.target.value } : p))}
                      className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    >
                      <option value="open">{statusLabel('open')}</option>
                      <option value="returned">{statusLabel('returned')}</option>
                      <option value="archived">{statusLabel('archived')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Místo</div>
                  <input
                    value={editing.location || ''}
                    onChange={(e) => setEditing((p) => (p ? { ...p, location: e.target.value } : p))}
                    className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kontakt</div>
                  <input
                    value={editing.contact || ''}
                    onChange={(e) => setEditing((p) => (p ? { ...p, contact: e.target.value } : p))}
                    className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setEditing((p) => (p ? { ...p, is_public: !p.is_public } : p))}
                  className={`w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                    editing.is_public
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {editing.is_public ? (
                    <span className="inline-flex items-center gap-2"><Eye size={16} /> Veřejné</span>
                  ) : (
                    <span className="inline-flex items-center gap-2"><EyeOff size={16} /> Skryté</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="w-full bg-green-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20 disabled:opacity-50"
                >
                  {saving ? <InlinePulse className="bg-white/80" size={16} /> : <Save size={18} />} Uložit
                </button>
              </div>
            </AdminPanel>
          ) : (
            <AdminPanel className="p-8 rounded-[2.5rem]">
              <div className="text-stone-900 font-black">Vyber položku nebo přidej novou</div>
              <div className="text-stone-400 font-medium mt-2">Tip: přidej místo a kontakt pro rychlé vrácení.</div>
            </AdminPanel>
          )}
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <InlinePulse className="bg-stone-200" size={20} />
            </div>
          ) : filtered.length === 0 ? (
            <AdminEmptyState icon={KeyRound} title="Žádné položky" description="Přidej první položku do ztrát a nálezů." />
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {filtered.map((i) => (
                <div key={i.id} className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-black text-stone-900 text-lg truncate">{i.title}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                        {new Date(i.created_at).toLocaleDateString('cs-CZ')}
                        {i.category ? ` • ${i.category}` : ''}
                        {i.status ? ` • ${statusLabel(i.status)}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(i)}
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                      >
                        Upravit
                      </button>
                      <button
                        type="button"
                        onClick={() => askDelete(i.id)}
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {i.description ? <div className="mt-4 text-stone-600 font-medium leading-relaxed">{i.description}</div> : null}
                  <div className="mt-6 grid gap-2">
                    {i.location ? (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <MapPin size={16} className="text-green-600" /> {i.location}
                      </div>
                    ) : null}
                    {i.contact ? (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <Phone size={16} className="text-green-600" /> {i.contact}
                      </div>
                    ) : null}
                    {i.is_public ? (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <Eye size={16} className="text-green-600" /> Veřejné
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <EyeOff size={16} className="text-stone-400" /> Skryté
                      </div>
                    )}
                    {i.category ? (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <Tag size={16} className="text-green-600" /> {i.category}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
      />
    </div>
  );
}
