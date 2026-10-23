'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import ConfirmModal from '@/app/components/ConfirmModal';
import { Siren, Plus, Save, Trash2, Eye, EyeOff, Phone, Mail, Link as LinkIcon, Tag } from 'lucide-react';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import AdminPanel from './ui/AdminPanel';

type Item = {
  id: string;
  title: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  note: string | null;
  is_public: boolean;
  sort_order: number;
};

export default function SosTab() {
  const { showToast } = useToast();
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
      const res = await fetch('/api/admin/sos', { headers: { Authorization: `Bearer ${token}` } });
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
      const hay = `${i.title} ${i.note || ''} ${i.category || ''} ${i.phone || ''} ${i.email || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  const startNew = () => {
    setEditing({
      id: '',
      title: '',
      category: 'Studijní',
      phone: '',
      email: '',
      url: '',
      note: '',
      is_public: true,
      sort_order: 0,
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
        const res = await fetch('/api/admin/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ item: editing }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Uložení selhalo');
      } else {
        const res = await fetch(`/api/admin/sos/${editing.id}`, {
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
      title: 'Smazat kontakt?',
      message: 'Opravdu chceš kontakt smazat? Tato akce je nevratná.',
      onConfirm: async () => {
        setModalOpen(false);
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (!token) throw new Error('Nepřihlášen');
          const res = await fetch(`/api/admin/sos/${id}`, {
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
        title="SOS kontakty"
        description="Rychlé kontakty pro prváky (studijní, koleje, lékař, bezpečnost…)."
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
                  <Siren className="text-red-600" size={18} /> {editing.id ? 'Upravit' : 'Nový kontakt'}
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
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Pořadí</div>
                    <input
                      type="number"
                      value={editing.sort_order}
                      onChange={(e) => setEditing((p) => (p ? { ...p, sort_order: Number(e.target.value) } : p))}
                      className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Telefon</div>
                  <input
                    value={editing.phone || ''}
                    onChange={(e) => setEditing((p) => (p ? { ...p, phone: e.target.value } : p))}
                    className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">E-mail</div>
                  <input
                    value={editing.email || ''}
                    onChange={(e) => setEditing((p) => (p ? { ...p, email: e.target.value } : p))}
                    className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">URL</div>
                  <input
                    value={editing.url || ''}
                    onChange={(e) => setEditing((p) => (p ? { ...p, url: e.target.value } : p))}
                    className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Poznámka</div>
                  <textarea
                    value={editing.note || ''}
                    onChange={(e) => setEditing((p) => (p ? { ...p, note: e.target.value } : p))}
                    rows={3}
                    className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
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
              <div className="text-stone-900 font-black">Vyber kontakt nebo přidej nový</div>
              <div className="text-stone-400 font-medium mt-2">Udržuj kategorie a pořadí pro rychlou orientaci.</div>
            </AdminPanel>
          )}
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <InlinePulse className="bg-stone-200" size={20} />
            </div>
          ) : filtered.length === 0 ? (
            <AdminEmptyState icon={Siren} title="Žádné kontakty" description="Přidej první SOS kontakt." />
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {filtered.map((i) => (
                <div key={i.id} className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-black text-stone-900 text-lg truncate">{i.title}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                        {i.category ? ` ${i.category}` : ''}
                        {Number.isFinite(i.sort_order) ? ` • ${i.sort_order}` : ''}
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
                  {i.note ? <div className="mt-4 text-stone-600 font-medium leading-relaxed">{i.note}</div> : null}
                  <div className="mt-6 grid gap-2">
                    {i.phone ? (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <Phone size={16} className="text-green-600" /> {i.phone}
                      </div>
                    ) : null}
                    {i.email ? (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <Mail size={16} className="text-green-600" /> {i.email}
                      </div>
                    ) : null}
                    {i.url ? (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <LinkIcon size={16} className="text-green-600" /> {i.url}
                      </div>
                    ) : null}
                    {i.category ? (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <Tag size={16} className="text-green-600" /> {i.category}
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
