'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Mail, Send, Save } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';

export default function AutomationTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [digest, setDigest] = useState<any>(null);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [digestConfig, setDigestConfig] = useState<any>({
    enabled: false,
    timezone: 'Europe/Prague',
    dayOfWeek: 1,
    hour: 9,
    minute: 0,
    windowMinutes: 20,
    maxRecipients: 200,
    minIntervalHours: 72,
  });
  const [lastScheduledAt, setLastScheduledAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const res = await fetch('/api/admin/digest', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setDigest(json.digest);

      setCfgLoading(true);
      const cfgRes = await fetch('/api/admin/digest-config', { headers: { Authorization: `Bearer ${token}` } });
      const cfgJson = await cfgRes.json().catch(() => ({}));
      if (cfgRes.ok) {
        if (cfgJson?.config) setDigestConfig(cfgJson.config);
        setLastScheduledAt(cfgJson?.lastScheduledAt || null);
      }
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
      setCfgLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const res = await fetch('/api/admin/digest', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Send failed');
      showToast(`Digest odeslán: ${json.to}`, 'success');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSending(false);
    }
  };

  const saveConfig = async () => {
    setCfgSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/digest-config/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ config: digestConfig }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      showToast('Uloženo', 'success');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setCfgSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Bot className="text-green-600" />
          {dict?.admin?.tabAutomation || 'Automatizace'}
        </h2>
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-50 px-3 py-1 rounded-full border">
          Digest
        </span>
      </div>

      {loading ? (
        <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm flex items-center justify-center">
          <InlinePulse className="bg-stone-200" size={18} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Přehled</div>
            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5 space-y-2">
              <div className="text-sm font-bold text-stone-700">Připravený týdenní digest</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                Přihlášky: {digest?.metrics?.apps ?? '—'} • RSVP: {digest?.metrics?.rsvps ?? '—'} • Projekty: {digest?.metrics?.joins ?? '—'}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                Nahlášení: {digest?.metrics?.reports ?? '—'} • Akce (14 dní): {digest?.metrics?.upcomingEvents ?? '—'}
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Plánování</div>
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={cfgSaving}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {cfgSaving ? <InlinePulse className="bg-stone-300" size={12} /> : <Save size={14} />}
                  Uložit
                </button>
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-3">
                {cfgLoading ? 'Načítání…' : lastScheduledAt ? `Naposledy: ${new Date(lastScheduledAt).toLocaleString('cs-CZ')}` : 'Naposledy: —'}
              </div>

              <button
                type="button"
                onClick={() => setDigestConfig((p: any) => ({ ...p, enabled: !p.enabled }))}
                className={`w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  digestConfig.enabled ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {digestConfig.enabled ? 'Zapnuto' : 'Vypnuto'}
              </button>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Den</div>
                  <input
                    value={String(digestConfig.dayOfWeek ?? 1)}
                    onChange={(e) => setDigestConfig((p: any) => ({ ...p, dayOfWeek: Number(e.target.value || 0) }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Hodina</div>
                  <input
                    value={String(digestConfig.hour ?? 9)}
                    onChange={(e) => setDigestConfig((p: any) => ({ ...p, hour: Number(e.target.value || 0) }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Minuta</div>
                  <input
                    value={String(digestConfig.minute ?? 0)}
                    onChange={(e) => setDigestConfig((p: any) => ({ ...p, minute: Number(e.target.value || 0) }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Okno</div>
                  <input
                    value={String(digestConfig.windowMinutes ?? 20)}
                    onChange={(e) => setDigestConfig((p: any) => ({ ...p, windowMinutes: Number(e.target.value || 0) }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Max</div>
                  <input
                    value={String(digestConfig.maxRecipients ?? 200)}
                    onChange={(e) => setDigestConfig((p: any) => ({ ...p, maxRecipients: Number(e.target.value || 0) }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Interval</div>
                  <input
                    value={String(digestConfig.minIntervalHours ?? 72)}
                    onChange={(e) => setDigestConfig((p: any) => ({ ...p, minIntervalHours: Number(e.target.value || 0) }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              {sending ? <InlinePulse className="bg-white/80" size={14} /> : <Send size={16} />}
              Odeslat digest
            </button>
            <button
              type="button"
              onClick={load}
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
            >
              <Mail size={16} />
              Obnovit náhled
            </button>
          </div>

          <div className="lg:col-span-7 bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Preview</div>
            <div className="border border-stone-100 rounded-2xl overflow-hidden">
              <iframe title="Digest preview" className="w-full h-[560px]" srcDoc={digest?.html || '<p>—</p>'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
