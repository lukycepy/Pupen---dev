'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import InlinePulse from '@/app/components/InlinePulse';
import { supabase } from '@/lib/supabase';
import { RefreshCcw, Server } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';

async function authFetch(url: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Unauthorized');
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Error');
  return json;
}

export default function DbHealthTab() {
  const { showToast } = useToast();

  const healthQuery = useQuery({
    queryKey: ['admin_db_health'],
    queryFn: async () => authFetch('/api/admin/db/health'),
    refetchInterval: 30_000,
  });

  const reloadSchemaCache = async () => {
    try {
      await authFetch('/api/admin/schema-cache/reload', { method: 'POST' });
      showToast('Schema cache obnoven', 'success');
      healthQuery.refetch();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  const loading = healthQuery.isLoading;
  const err = healthQuery.error ? String((healthQuery.error as any)?.message || 'Chyba') : '';
  const missing = (healthQuery.data as any)?.missing || (healthQuery.data as any)?.health?.missing || [];
  const ok = Array.isArray(missing) ? missing.length === 0 : !!(healthQuery.data as any)?.health?.ok;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-stone-50 border border-stone-100">
            <Server size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Systém</div>
            <h2 className="text-xl font-black text-stone-900">DB Health</h2>
            <p className="text-sm text-stone-600 font-medium">
              Kontrola kritických tabulek a možnost obnovit schema cache.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reloadSchemaCache}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-stone-900 text-white font-black uppercase tracking-widest text-[10px] hover:bg-stone-800 transition"
        >
          <RefreshCcw size={14} />
          Reload cache
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-3 text-stone-500 font-bold">
            <InlinePulse className="bg-stone-200" size={16} />
            Načítám…
          </div>
        ) : err ? (
          <div className="text-sm font-bold text-red-600">{err}</div>
        ) : ok ? (
          <div className="text-sm font-bold text-green-700">OK – všechny kritické tabulky jsou dostupné.</div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm font-bold text-red-600">Chybí tabulky: {missing.join(', ')}</div>
            <div className="text-xs text-stone-500 font-medium">
              Pokud je schéma správně migrované, pomůže obvykle „Reload cache“. Pokud tabulky chybí, spusť migrace.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

