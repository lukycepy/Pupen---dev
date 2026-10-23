'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import { Wrench, Trash2, ShieldCheck, Mail, Ban } from 'lucide-react';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';

export default function GodModeTab() {
  const { showToast } = useToast();
  const [clearingCache, setClearingCache] = useState(false);
  const [reloadingSchema, setReloadingSchema] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [loadingBans, setLoadingBans] = useState(false);
  const [bans, setBans] = useState<any[]>([]);
  const [creatingBan, setCreatingBan] = useState(false);
  const [banKind, setBanKind] = useState<'ip' | 'identity'>('ip');
  const [banValue, setBanValue] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banExpiresAt, setBanExpiresAt] = useState('');

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

  const processQueue = async () => {
    setProcessingQueue(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/queue/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limit: 50, resetStuck: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast(`Queue: processed ${json?.processed || 0}, ok ${json?.okCount || 0}, retry ${json?.retried || 0}, dead ${json?.dead || 0}`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setProcessingQueue(false);
    }
  };

  const loadBans = useCallback(async () => {
    setLoadingBans(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/security-bans', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      setBans(Array.isArray(json?.bans) ? json.bans : []);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoadingBans(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBans();
  }, [loadBans]);

  const activeBans = useMemo(() => {
    const now = Date.now();
    return (bans || []).filter((b: any) => {
      if (!b) return false;
      if (b.active !== true) return false;
      if (b.revoked_at) return false;
      if (!b.expires_at) return true;
      const t = Date.parse(String(b.expires_at));
      return !Number.isFinite(t) || t > now;
    });
  }, [bans]);

  const createBan = async () => {
    setCreatingBan(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/security-bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: banKind,
          value: banValue,
          reason: banReason,
          expires_at: banExpiresAt ? new Date(banExpiresAt).toISOString() : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast('Ban uložen', 'success');
      setBanValue('');
      setBanReason('');
      setBanExpiresAt('');
      await loadBans();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setCreatingBan(false);
    }
  };

  const revokeBan = async (id: number) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch(`/api/admin/security-bans/${id}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast('Ban zrušen', 'success');
      await loadBans();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <AdminModuleHeader
        title="Údržba"
        description="Údržbové nástroje pro provoz: cache, schema cache, e-mailová fronta, banování."
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
              onClick={processQueue}
              disabled={processingQueue}
              className="bg-stone-50 text-stone-800 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-stone-100 transition border border-stone-200 disabled:opacity-50"
            >
              {processingQueue ? <InlinePulse className="bg-stone-200" size={16} /> : <Mail size={18} />} Zpracovat e-mail frontu
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
      </AdminPanel>

      <AdminPanel className="p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-stone-900">
            <Ban className="text-red-600" size={18} />
            <div className="font-black">Banování IP / identity</div>
          </div>
          <button
            type="button"
            onClick={loadBans}
            disabled={loadingBans}
            className="bg-stone-50 text-stone-800 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-stone-100 transition border border-stone-200 disabled:opacity-50"
          >
            {loadingBans ? <InlinePulse className="bg-stone-200" size={16} /> : <ShieldCheck size={18} />} Obnovit
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 p-6 rounded-[2rem] bg-stone-50 border border-stone-100 space-y-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Nový ban</div>
            <div className="space-y-3">
              <select
                value={banKind}
                onChange={(e) => setBanKind(e.target.value === 'identity' ? 'identity' : 'ip')}
                className="w-full rounded-2xl px-4 py-3 border border-stone-200 bg-white font-bold text-stone-800"
              >
                <option value="ip">IP (cidr)</option>
                <option value="identity">Identity (uuid)</option>
              </select>
              <input
                value={banValue}
                onChange={(e) => setBanValue(e.target.value)}
                placeholder={banKind === 'ip' ? '1.2.3.4 nebo 1.2.3.0/24' : 'uuid uživatele'}
                className="w-full rounded-2xl px-4 py-3 border border-stone-200 bg-white font-bold text-stone-800"
              />
              <input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Důvod (volitelné)"
                className="w-full rounded-2xl px-4 py-3 border border-stone-200 bg-white font-bold text-stone-800"
              />
              <input
                type="datetime-local"
                value={banExpiresAt}
                onChange={(e) => setBanExpiresAt(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 border border-stone-200 bg-white font-bold text-stone-800"
              />
              <button
                type="button"
                onClick={createBan}
                disabled={creatingBan || !banValue.trim()}
                className="w-full bg-red-50 text-red-700 px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-red-100 transition border border-red-200 disabled:opacity-50"
              >
                {creatingBan ? <InlinePulse className="bg-red-200" size={16} /> : <Ban size={18} />} Přidat ban
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Aktivní bany</div>
            {loadingBans ? (
              <div className="flex items-center gap-3 text-stone-500 font-bold">
                <InlinePulse className="bg-stone-200" size={18} /> Načítám…
              </div>
            ) : activeBans.length ? (
              <div className="space-y-3">
                {activeBans.map((b: any) => (
                  <div key={b.id} className="p-5 rounded-[2rem] bg-white border border-stone-100 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                        {String(b.kind || '').toUpperCase()} · #{b.id}
                      </div>
                      <div className="text-stone-900 font-black mt-1 break-all">
                        {b.kind === 'ip' ? String(b.ip || '') : String(b.identity_id || '')}
                      </div>
                      {b.reason ? <div className="text-stone-600 font-bold mt-1">{String(b.reason)}</div> : null}
                      <div className="text-stone-400 text-xs font-bold mt-1">
                        {b.expires_at ? `Do: ${new Date(String(b.expires_at)).toLocaleString('cs-CZ')}` : 'Bez expirace'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => revokeBan(Number(b.id))}
                      className="shrink-0 bg-stone-50 text-stone-800 px-5 py-2.5 rounded-2xl font-black flex items-center gap-2 hover:bg-stone-100 transition border border-stone-200"
                    >
                      <Trash2 size={16} /> Zrušit
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-[2rem] bg-stone-50 border border-stone-100 text-stone-600 font-bold">Žádné aktivní bany.</div>
            )}
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
