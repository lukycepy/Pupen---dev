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

  const [runningSeo, setRunningSeo] = useState(false);
  const [resultSeo, setResultSeo] = useState<any>(null);

  const runSeo = async () => {
    setRunningSeo(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/seo-audit/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Scan failed');
      setResultSeo(json);
      showToast('Hotovo', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setRunningSeo(false);
    }
  };

  return (
    <div className="space-y-8">
      <AdminModuleHeader
        title="SEO & Broken Links Checker"
        description="Kontrola URL a SEO tagů (canonical, hreflang, H1) z `/sitemap.xml` (max 200)."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={running || runningSeo}
              className="bg-stone-100 text-stone-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-stone-200 transition disabled:opacity-50"
            >
              {running ? <InlinePulse className="bg-stone-400" size={16} /> : <Link2 size={18} />} Zkontrolovat odkazy
            </button>
            <button
              type="button"
              onClick={runSeo}
              disabled={running || runningSeo}
              className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20 disabled:opacity-50"
            >
              {runningSeo ? <InlinePulse className="bg-white/80" size={16} /> : <Play size={18} />} Spustit SEO Audit
            </button>
          </div>
        }
      />

      <AdminPanel className="p-8 rounded-[2.5rem]">
        {/* BROKEN LINKS VÝSLEDKY */}
        {result && (
          <div className="space-y-4 mb-8">
            <h3 className="font-bold text-stone-900 border-b pb-2">Výsledky kontroly odkazů</h3>
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

        {/* SEO AUDIT VÝSLEDKY */}
        {resultSeo && (
          <div className="space-y-4">
            <h3 className="font-bold text-stone-900 border-b pb-2">Výsledky SEO auditu</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-stone-50 border border-stone-100 text-[10px] font-black uppercase tracking-widest text-stone-500">
                Scanned: {resultSeo.scanned}
              </div>
              <div className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
                resultSeo.issuesFound > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-green-700'
              }`}
              >
                Problémy na stránkách: {resultSeo.issuesFound}
              </div>
            </div>

            {resultSeo.issuesFound === 0 ? (
              <div className="flex items-center gap-2 text-green-700 font-bold">
                <Link2 size={18} /> SEO tagy vypadají v pořádku.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-2">
                  {(resultSeo.details || []).map((r: any) => (
                    <div key={r.url} className="p-4 rounded-2xl bg-stone-50 border border-amber-100">
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-stone-700 hover:text-green-700 transition break-all mb-2 block">
                        {r.url}
                      </a>
                      <div className="flex flex-col gap-1">
                        {r.error && <span className="text-red-600 text-xs font-bold">Chyba: {r.error}</span>}
                        {(r.issues || []).map((issue: string, idx: number) => (
                          <span key={idx} className="text-amber-700 text-xs flex items-center gap-1">
                            <AlertTriangle size={12} /> {issue}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !resultSeo && (
          <div className="text-stone-600 font-medium">Spusťte kontrolu odkazů nebo SEO audit výše. Obojí kontroluje obsah `/sitemap.xml`.</div>
        )}
      </AdminPanel>
    </div>
  );
}
