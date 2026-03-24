'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import { Wrench, Trash2, ShieldCheck } from 'lucide-react';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';

export default function GodModeTab() {
  const { showToast } = useToast();
  const [clearingCache, setClearingCache] = useState(false);
  const [reloadingSchema, setReloadingSchema] = useState(false);

  const clearCache = async () => {
    setClearingCache(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/god/clear-cache', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast('Cache vyčištěna', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setClearingCache(false);
    }
  };

  const reloadSchemaCache = async () => {
    setReloadingSchema(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/schema-cache/reload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast('Schema cache obnovena', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setReloadingSchema(false);
    }
  };

  return (
    <div className="space-y-8">
      <AdminModuleHeader
        title="God Mode"
        description="Pokročilé úkony pro IT správce (bezpečně, auditovatelně)."
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reloadSchemaCache}
              disabled={reloadingSchema}
              className="bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-100 transition border border-blue-200 disabled:opacity-50"
            >
              {reloadingSchema ? <InlinePulse className="bg-blue-200" size={16} /> : <ShieldCheck size={18} />} Reload schema cache
            </button>
            <button
              type="button"
              onClick={clearCache}
              disabled={clearingCache}
              className="bg-red-50 text-red-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-100 transition border border-red-200 disabled:opacity-50"
            >
              {clearingCache ? <InlinePulse className="bg-red-200" size={16} /> : <Trash2 size={18} />} Vyčistit cache
            </button>
          </div>
        }
      />

      <AdminPanel className="p-8 rounded-[2.5rem] space-y-4">
        <div className="flex items-center gap-3 text-stone-900">
          <Wrench className="text-green-600" size={18} />
          <div className="font-black">Co se vyčistí</div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="p-5 rounded-[2rem] bg-stone-50 border border-stone-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Site config cache</div>
            <div className="text-stone-700 font-bold mt-1">Konfigurace stránek / odstávky</div>
          </div>
          <div className="p-5 rounded-[2rem] bg-stone-50 border border-stone-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Dictionary cache</div>
            <div className="text-stone-700 font-bold mt-1">Slovníky překladů</div>
          </div>
        </div>
        <div className="flex items-start gap-3 p-5 rounded-[2rem] bg-green-50 border border-green-200">
          <ShieldCheck className="text-green-700 mt-0.5" size={18} />
          <div className="text-sm text-green-800 font-bold">
            Příští krok: přidat banování spammerů a serverové logy (bez úniku citlivých dat).
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
