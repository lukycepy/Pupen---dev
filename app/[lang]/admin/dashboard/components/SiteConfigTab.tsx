'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import { Globe, Save, ShieldAlert } from 'lucide-react';

type PageCfg = { enabled?: boolean; navbar?: boolean; tools?: boolean };
type SiteCfg = {
  maintenance_enabled: boolean;
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  maintenance_title_cs: string | null;
  maintenance_body_cs: string | null;
  maintenance_title_en: string | null;
  maintenance_body_en: string | null;
  pages: Record<string, PageCfg>;
};

const DEFAULT_PAGES: { slug: string; group: 'Navbar' | 'Nástroje' | 'Ostatní'; labelKey?: string; toolKey?: string }[] = [
  { slug: 'akce', group: 'Navbar', labelKey: 'events' },
  { slug: 'novinky', group: 'Navbar', labelKey: 'news' },
  { slug: 'o-nas', group: 'Navbar', labelKey: 'about' },
  { slug: 'kontakt', group: 'Navbar', labelKey: 'contact' },
  { slug: 'prihlaska', group: 'Ostatní' },
  { slug: 'sos', group: 'Nástroje', toolKey: 'sos' },
  { slug: 'ztraty-a-nalezy', group: 'Nástroje', toolKey: 'lostFound' },
  { slug: 'predmety', group: 'Nástroje', toolKey: 'subjects' },
  { slug: 'harmonogram', group: 'Nástroje', toolKey: 'schedule' },
  { slug: 'pruvodce', group: 'Nástroje', toolKey: 'guide' },
  { slug: 'partaci', group: 'Nástroje', toolKey: 'partners' },
  { slug: 'slevy', group: 'Nástroje', toolKey: 'discounts' },
  { slug: 'oteviraci-doba', group: 'Nástroje', toolKey: 'hours' },
  { slug: 'blog', group: 'Nástroje', toolKey: 'blog' },
  { slug: 'kvizy', group: 'Nástroje', toolKey: 'quizzes' },
  { slug: 'kariera', group: 'Nástroje', toolKey: 'jobs' },
  { slug: 'faq', group: 'Nástroje', toolKey: 'faq' },
];

export default function SiteConfigTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SiteCfg>({
    maintenance_enabled: false,
    maintenance_start_at: null,
    maintenance_end_at: null,
    maintenance_title_cs: null,
    maintenance_body_cs: null,
    maintenance_title_en: null,
    maintenance_body_en: null,
    pages: {},
  });

  const toLocalInput = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const pageLabel = useMemo(() => {
    const nav = dict?.nav || {};
    const tools = nav?.tools || {};
    const map = new Map<string, string>();
    for (const p of DEFAULT_PAGES) {
      if (p.labelKey) map.set(p.slug, String(nav?.[p.labelKey] || p.slug));
      else if (p.toolKey) map.set(p.slug, String(tools?.[p.toolKey]?.title || p.slug));
      else map.set(p.slug, p.slug);
    }
    return map;
  }, [dict]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Nepřihlášen');
        const res = await fetch('/api/admin/site-config', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Request failed');
        const row = json?.config || {};
        const next: SiteCfg = {
          maintenance_enabled: !!row.maintenance_enabled,
          maintenance_start_at: row.maintenance_start_at || null,
          maintenance_end_at: row.maintenance_end_at || null,
          maintenance_title_cs: row.maintenance_title_cs || null,
          maintenance_body_cs: row.maintenance_body_cs || null,
          maintenance_title_en: row.maintenance_title_en || null,
          maintenance_body_en: row.maintenance_body_en || null,
          pages: (row.pages && typeof row.pages === 'object' ? row.pages : {}) as any,
        };
        if (mounted) setConfig(next);
      } catch (e: any) {
        showToast(e?.message || 'Chyba', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  const updatePage = (slug: string, patch: Partial<PageCfg>) => {
    setConfig((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        [slug]: { ...(prev.pages?.[slug] || {}), ...patch },
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ config }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Uložení selhalo');
      showToast('Uloženo', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, typeof DEFAULT_PAGES> = { Navbar: [], 'Nástroje': [], 'Ostatní': [] } as any;
    for (const p of DEFAULT_PAGES) g[p.group].push(p as any);
    return g;
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Globe className="text-green-600" />
          {dict.admin?.tabSitePages || 'Stránky'}
        </h2>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
        >
          {saving ? <InlinePulse className="bg-white/80" size={16} /> : <Save size={16} />}
          Uložit
        </button>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-black text-stone-900 flex items-center gap-2">
              <ShieldAlert className="text-orange-500" size={18} />
              Plánovaná odstávka
            </div>
            <div className="text-sm text-stone-600 font-medium mt-1">
              Pokud je zapnuto, veřejné stránky přesměrují na `/{'{lang}'}/odstavka` (admin a člen zůstávají dostupné).
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfig((p) => ({ ...p, maintenance_enabled: !p.maintenance_enabled }))}
            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
              config.maintenance_enabled
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {config.maintenance_enabled ? 'Zapnuto' : 'Vypnuto'}
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Začátek</div>
            <input
              type="datetime-local"
              value={toLocalInput(config.maintenance_start_at)}
              onChange={(e) => {
                const v = e.target.value;
                setConfig((p) => ({ ...p, maintenance_start_at: v ? new Date(v).toISOString() : null }));
              }}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Konec</div>
            <input
              type="datetime-local"
              value={toLocalInput(config.maintenance_end_at)}
              onChange={(e) => {
                const v = e.target.value;
                setConfig((p) => ({ ...p, maintenance_end_at: v ? new Date(v).toISOString() : null }));
              }}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, maintenance_start_at: null, maintenance_end_at: null }))}
              className="w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
            >
              Vyčistit čas
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Titulek (CZ)</div>
            <input
              value={config.maintenance_title_cs || ''}
              onChange={(e) => setConfig((p) => ({ ...p, maintenance_title_cs: e.target.value }))}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              placeholder="Plánovaná odstávka"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Title (EN)</div>
            <input
              value={config.maintenance_title_en || ''}
              onChange={(e) => setConfig((p) => ({ ...p, maintenance_title_en: e.target.value }))}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              placeholder="Planned maintenance"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Text (CZ)</div>
            <textarea
              value={config.maintenance_body_cs || ''}
              onChange={(e) => setConfig((p) => ({ ...p, maintenance_body_cs: e.target.value }))}
              rows={4}
              className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Text (EN)</div>
            <textarea
              value={config.maintenance_body_en || ''}
              onChange={(e) => setConfig((p) => ({ ...p, maintenance_body_en: e.target.value }))}
              rows={4}
              className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8">
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : (
          Object.entries(grouped).map(([groupName, pages]) => (
            <div key={groupName} className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{groupName}</div>
              <div className="grid gap-3">
                {pages.map((p) => {
                  const cfg = config.pages?.[p.slug] || {};
                  return (
                    <div
                      key={p.slug}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-stone-50 rounded-[2rem] border border-stone-100"
                    >
                      <div className="min-w-0">
                        <div className="font-black text-stone-900 truncate">{pageLabel.get(p.slug)}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">/{p.slug}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updatePage(p.slug, { enabled: cfg.enabled === false ? true : false })}
                          className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                            cfg.enabled === false
                              ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                              : 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                          }`}
                        >
                          {cfg.enabled === false ? 'Skryto' : 'Zobrazeno'}
                        </button>
                        {p.group === 'Navbar' && (
                          <button
                            type="button"
                            onClick={() => updatePage(p.slug, { navbar: cfg.navbar === false ? true : false })}
                            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                              cfg.navbar === false
                                ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                                : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                            }`}
                          >
                            {cfg.navbar === false ? 'Mimo navbar' : 'V navbaru'}
                          </button>
                        )}
                        {p.group === 'Nástroje' && (
                          <button
                            type="button"
                            onClick={() => updatePage(p.slug, { tools: cfg.tools === false ? true : false })}
                            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                              cfg.tools === false
                                ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                                : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                            }`}
                          >
                            {cfg.tools === false ? 'Mimo nástroje' : 'V nástrojích'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
