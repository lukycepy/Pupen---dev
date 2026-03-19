'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import { Link2, Play, AlertTriangle } from 'lucide-react';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';

export default function BrokenLinksTab() {
  const { showToast } = useToast();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setRunning(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/broken-links/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Scan failed');
      setResult(json);
      showToast('Hotovo', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <AdminModuleHeader
        title="Broken Link Checker"
        description="Rychlá kontrola URL z `/sitemap.xml` (max 200)."
        actions={
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20 disabled:opacity-50"
          >
            {running ? <InlinePulse className="bg-white/80" size={16} /> : <Play size={18} />} Spustit
          </button>
        }
      />

      <AdminPanel className="p-8 rounded-[2.5rem]">
        {!result ? (
          <div className="text-stone-600 font-medium">Klikni na „Spustit“ a uvidíš seznam rozbitých odkazů. Používá se sitemap na aktuálním hostu.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-stone-50 border border-stone-100 text-[10px] font-black uppercase tracking-widest text-stone-500">
                Base: {result.base}
              </div>
              <div className="px-4 py-2 rounded-xl bg-stone-50 border border-stone-100 text-[10px] font-black uppercase tracking-widest text-stone-500">
                Scanned: {result.scanned}
              </div>
              <div className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
                (result.broken || []).length ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
              }`}
              >
                Broken: {(result.broken || []).length}
              </div>
            </div>

            {(result.broken || []).length === 0 ? (
              <div className="flex items-center gap-2 text-green-700 font-bold">
                <Link2 size={18} /> Vypadá to čistě.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-bold">
                  <AlertTriangle size={18} /> Rozbité odkazy
                </div>
                <div className="grid gap-2">
                  {(result.broken || []).slice(0, 200).map((r: any) => (
                    <div key={r.url} className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{r.status}</div>
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-stone-700 hover:text-green-700 transition break-all">
                        {r.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
