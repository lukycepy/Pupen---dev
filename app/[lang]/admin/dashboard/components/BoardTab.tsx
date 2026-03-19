'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Save, Plus, X } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';

type RoleRow = {
  role: string;
  name: string;
  email: string;
  note?: string;
};

export default function BoardTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/governance/board', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setRoles(Array.isArray(json.roles) ? json.roles : []);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const normalized = useMemo(
    () =>
      roles
        .map((r) => ({
          role: (r.role || '').trim(),
          name: (r.name || '').trim(),
          email: (r.email || '').trim(),
          note: (r.note || '').trim(),
        }))
        .filter((r) => r.role || r.name || r.email),
    [roles]
  );

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/board/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roles: normalized }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      showToast('Uloženo', 'success');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <Users className="text-green-600" />
              {dict?.admin?.tabBoard || 'Vedení'}
            </h2>
            <p className="text-stone-500 font-medium">Adresář vedení a rolí.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRoles((prev) => [...prev, { role: '', name: '', email: '', note: '' }])}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              <Plus size={16} />
              Přidat
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              {saving ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />}
              Uložit
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : roles.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">Zatím prázdné.</div>
        ) : (
          <div className="space-y-3">
            {roles.map((r, idx) => (
              <div key={idx} className="bg-stone-50 border border-stone-100 rounded-[2rem] p-5">
                <div className="grid md:grid-cols-12 gap-3 items-start">
                  <div className="md:col-span-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Role</div>
                    <input
                      value={r.role}
                      onChange={(e) => setRoles((prev) => prev.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)))}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                      placeholder="Předseda / Pokladník…"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Jméno</div>
                    <input
                      value={r.name}
                      onChange={(e) => setRoles((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                      placeholder="Jméno a příjmení"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">E-mail</div>
                    <input
                      value={r.email}
                      onChange={(e) => setRoles((prev) => prev.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x)))}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                      placeholder="role@pupen.org"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => setRoles((prev) => prev.filter((_, i) => i !== idx))}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      <X size={16} />
                      Odebrat
                    </button>
                  </div>
                  <div className="md:col-span-12">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-2">Poznámka</div>
                    <input
                      value={r.note || ''}
                      onChange={(e) => setRoles((prev) => prev.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                      placeholder="Např. kontakt pro externí dotazy"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
