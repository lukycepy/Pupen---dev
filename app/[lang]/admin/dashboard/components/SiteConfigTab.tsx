'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import { Globe, Save, ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import { SITE_PAGES } from '@/lib/site/pages-registry';
import { CMS_PAGES } from '@/lib/site/cms-pages-registry';

type PageCfg = { enabled?: boolean; navbar?: boolean; tools?: boolean };
type SiteCfg = {
  maintenance_enabled: boolean;
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  maintenance_title_cs: string | null;
  maintenance_body_cs: string | null;
  maintenance_title_en: string | null;
  maintenance_body_en: string | null;
  home?: any;
  member_portal?: any;
  pages: Record<string, PageCfg>;
};

const DEFAULT_PAGES: { slug: string; group: 'Navbar' | 'Nástroje' | 'Ostatní'; labelKey?: string; toolKey?: string }[] = SITE_PAGES.map((p) => ({
  slug: p.slug,
  group: p.group,
  labelKey: p.labelKey,
  toolKey: p.toolKey,
}));

const MEMBER_TABS: string[] = [
  'dashboard',
  'notifications',
  'events',
  'my_events',
  'documents',
  'card',
  'guidelines',
  'release_notes',
  'articles',
  'messages',
  'directory',
  'projects',
  'polls',
  'governance',
  'board',
  'settings',
];

const DIRECTORY_FIELDS: { id: string; labelCs: string; labelEn: string }[] = [
  { id: 'email', labelCs: 'E-mail', labelEn: 'Email' },
  { id: 'member_since', labelCs: 'Členem od', labelEn: 'Member since' },
  { id: 'city', labelCs: 'Město', labelEn: 'City' },
  { id: 'member_no', labelCs: 'Členské číslo', labelEn: 'Member number' },
  { id: 'address', labelCs: 'Adresa', labelEn: 'Address' },
];

const Editor = dynamic(() => import('../../../components/Editor'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />,
});

export default function SiteConfigTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const mpDict = dict?.memberPortalConfig || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<'pages' | 'content' | 'home' | 'member' | 'maintenance'>('pages');
  const [config, setConfig] = useState<SiteCfg>({
    maintenance_enabled: false,
    maintenance_start_at: null,
    maintenance_end_at: null,
    maintenance_title_cs: null,
    maintenance_body_cs: null,
    maintenance_title_en: null,
    maintenance_body_en: null,
    home: {
      widgets: {
        hero: true,
        countdown: true,
        about: true,
        news: true,
        poll: true,
        testimonials: true,
        instagram: true,
        partners: true,
        newsletter: true,
        cta: true,
      },
      hero: { backgrounds: [] as string[] },
      instagram: { url: 'https://instagram.com/pupenfappz/', handle: '@pupenfappz' },
    },
    member_portal: {
      show_onboarding: true,
      hidden_tabs: [],
      default_tab: null,
      support_email: 'support@pupen.org',
      support_phone: null,
      quick_links: [],
    },
    pages: {},
  });

  const [pageEditorSlug, setPageEditorSlug] = useState<string>('o-nas');
  const [pageEditorLoading, setPageEditorLoading] = useState(false);
  const [pageEditorSaving, setPageEditorSaving] = useState(false);
  const [pageCsTitle, setPageCsTitle] = useState('');
  const [pageCsHtml, setPageCsHtml] = useState('');
  const [pageEnTitle, setPageEnTitle] = useState('');
  const [pageEnHtml, setPageEnHtml] = useState('');

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
    for (const p of CMS_PAGES) {
      const prev = map.get(p.slug);
      if (!prev || prev === p.slug) map.set(p.slug, p.label);
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
          home: row.home && typeof row.home === 'object' ? row.home : null,
          member_portal: row.member_portal && typeof row.member_portal === 'object' ? row.member_portal : null,
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
      const patch =
        section === 'maintenance'
          ? {
              maintenance_enabled: config.maintenance_enabled,
              maintenance_start_at: config.maintenance_start_at || null,
              maintenance_end_at: config.maintenance_end_at || null,
              maintenance_title_cs: config.maintenance_title_cs || null,
              maintenance_body_cs: config.maintenance_body_cs || null,
              maintenance_title_en: config.maintenance_title_en || null,
              maintenance_body_en: config.maintenance_body_en || null,
            }
          : section === 'home'
            ? { home: config.home || {} }
            : section === 'member'
              ? { member_portal: (config as any).member_portal || {} }
              : { pages: config.pages || {} };
      const res = await fetch('/api/admin/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section, config: patch }),
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

  const pageMeta = useMemo(() => {
    const m = new Map<string, { group: string; label: string }>();
    for (const p of DEFAULT_PAGES) m.set(p.slug, { group: p.group, label: pageLabel.get(p.slug) || p.slug });
    for (const p of CMS_PAGES) m.set(p.slug, { group: 'CMS', label: pageLabel.get(p.slug) || p.label });
    return m;
  }, [pageLabel]);

  const contentSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const p of DEFAULT_PAGES) s.add(p.slug);
    for (const p of CMS_PAGES) s.add(p.slug);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPageEditorLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Nepřihlášen');
        const res = await fetch(`/api/admin/site-pages/${encodeURIComponent(pageEditorSlug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Chyba');
        const items = Array.isArray(json?.items) ? json.items : [];
        const cs = items.find((x: any) => x?.lang === 'cs') || null;
        const en = items.find((x: any) => x?.lang === 'en') || null;
        if (!alive) return;
        setPageCsTitle(String(cs?.title || ''));
        setPageCsHtml(String(cs?.content_html || ''));
        setPageEnTitle(String(en?.title || ''));
        setPageEnHtml(String(en?.content_html || ''));
      } catch (e: any) {
        if (!alive) return;
        showToast(e?.message || 'Chyba', 'error');
      } finally {
        if (alive) setPageEditorLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pageEditorSlug, showToast]);

  const savePageContent = async () => {
    setPageEditorSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch(`/api/admin/site-pages/${encodeURIComponent(pageEditorSlug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cs: { title: pageCsTitle, content_html: pageCsHtml },
          en: { title: pageEnTitle, content_html: pageEnHtml },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Uložení selhalo');
      showToast('Obsah uložen', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setPageEditorSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Globe className="text-green-600" />
          {dict.admin?.tabSitePages || 'Stránky'}
        </h2>
        {section === 'content' ? (
          <button
            type="button"
            onClick={savePageContent}
            disabled={pageEditorSaving || pageEditorLoading}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {pageEditorSaving ? <InlinePulse className="bg-white/80" size={16} /> : <Save size={16} />}
            Uložit obsah
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? <InlinePulse className="bg-white/80" size={16} /> : <Save size={16} />}
            Uložit nastavení
          </button>
        )}
      </div>

      <div className="bg-white p-2 rounded-[2rem] border shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            ['pages', 'Navigace'],
            ['content', 'Obsah'],
            ['home', 'Domů'],
            ['member', 'Členský portál'],
            ['maintenance', 'Odstávka'],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSection(k as any)}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                section === k ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === 'maintenance' && (
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
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <Editor value={config.maintenance_body_cs || ''} onChange={(v: string) => setConfig((p) => ({ ...p, maintenance_body_cs: v }))} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Text (EN)</div>
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <Editor value={config.maintenance_body_en || ''} onChange={(v: string) => setConfig((p) => ({ ...p, maintenance_body_en: v }))} />
            </div>
          </div>
        </div>
      </div>
      )}

      {section === 'home' && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-black text-stone-900">Homepage widgety</div>
            <div className="text-sm text-stone-600 font-medium mt-1">Skrytí/zobrazení a základní nastavení widgetů na úvodní stránce.</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {[
              ['hero', 'Hero'],
              ['countdown', 'Odpočet akce'],
              ['about', 'O nás'],
              ['news', 'Novinky'],
              ['poll', 'Anketa'],
              ['testimonials', 'Reference'],
              ['instagram', 'Instagram'],
              ['partners', 'Partneři'],
              ['newsletter', 'Newsletter'],
              ['cta', 'CTA'],
            ].map(([k, label]) => {
              const enabled = config.home?.widgets?.[k as any] !== false;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setConfig((p) => ({
                      ...p,
                      home: {
                        ...(p.home || {}),
                        widgets: { ...(p.home?.widgets || {}), [k]: enabled ? false : true },
                      },
                    }))
                  }
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition ${
                    enabled ? 'bg-white border-stone-200 hover:bg-stone-50' : 'bg-stone-50 border-stone-200 text-stone-400'
                  }`}
                >
                  <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${enabled ? 'text-green-600' : 'text-stone-400'}`}>
                    {enabled ? 'Zobrazeno' : 'Skryto'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-5">
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-stone-100">
                <div className="text-sm font-black text-stone-900">Reference (Homepage)</div>
                <div className="text-xs text-stone-500 font-medium mt-1">Obsah pro slider referencí na úvodní stránce.</div>
              </div>
              <div className="p-5 grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">CZ (HTML)</div>
                  <Editor
                    value={String((config.home as any)?.testimonials?.html_cs || '')}
                    onChange={(v: string) =>
                      setConfig((p) => ({
                        ...p,
                        home: { ...(p.home || {}), testimonials: { ...((p.home as any)?.testimonials || {}), html_cs: v } },
                      }))
                    }
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">EN (HTML)</div>
                  <Editor
                    value={String((config.home as any)?.testimonials?.html_en || '')}
                    onChange={(v: string) =>
                      setConfig((p) => ({
                        ...p,
                        home: { ...(p.home || {}), testimonials: { ...((p.home as any)?.testimonials || {}), html_en: v } },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-stone-100">
                <div className="text-sm font-black text-stone-900">CTA (Homepage)</div>
                <div className="text-xs text-stone-500 font-medium mt-1">Texty a odkazy CTA sekce.</div>
              </div>
              <div className="p-5 grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Badge (CZ)</div>
                  <input
                    value={String((config.home as any)?.cta?.badge_cs || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), badge_cs: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Title (CZ)</div>
                  <input
                    value={String((config.home as any)?.cta?.title_cs || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), title_cs: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Sub (CZ)</div>
                  <input
                    value={String((config.home as any)?.cta?.sub_cs || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), sub_cs: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Primární label (CZ)</div>
                      <input
                        value={String((config.home as any)?.cta?.primary_label_cs || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), primary_label_cs: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Sekundární label (CZ)</div>
                      <input
                        value={String((config.home as any)?.cta?.secondary_label_cs || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), secondary_label_cs: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Badge (EN)</div>
                  <input
                    value={String((config.home as any)?.cta?.badge_en || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), badge_en: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Title (EN)</div>
                  <input
                    value={String((config.home as any)?.cta?.title_en || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), title_en: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Sub (EN)</div>
                  <input
                    value={String((config.home as any)?.cta?.sub_en || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), sub_en: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Primary label (EN)</div>
                      <input
                        value={String((config.home as any)?.cta?.primary_label_en || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), primary_label_en: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Secondary label (EN)</div>
                      <input
                        value={String((config.home as any)?.cta?.secondary_label_en || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), secondary_label_en: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Primary href</div>
                      <input
                        value={String((config.home as any)?.cta?.primary_href || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), primary_href: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                        placeholder="/cs/kontakt"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Secondary href</div>
                      <input
                        value={String((config.home as any)?.cta?.secondary_href || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), secondary_href: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                        placeholder="/cs/akce"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">A/B hero backgrounds</div>
                <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-600">
                  <input
                    type="checkbox"
                    checked={!!config.home?.hero?.ab?.enabled}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        home: {
                          ...(p.home || {}),
                          hero: {
                            ...(p.home?.hero || {}),
                            ab: { ...(p.home?.hero?.ab || {}), enabled: e.target.checked },
                          },
                        },
                      }))
                    }
                    className="w-4 h-4"
                  />
                  Enabled
                </label>
              </div>

              {!!config.home?.hero?.ab?.enabled ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Split A (%)</div>
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={Number.isFinite(Number(config.home?.hero?.ab?.split)) ? Number(config.home?.hero?.ab?.split) : 50}
                      onChange={(e) => {
                        const v = Math.min(90, Math.max(10, Math.round(Number(e.target.value || 50))));
                        setConfig((p) => ({
                          ...p,
                          home: { ...(p.home || {}), hero: { ...(p.home?.hero || {}), ab: { ...(p.home?.hero?.ab || {}), split: v } } },
                        }));
                      }}
                      className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Backgrounds A (URL na řádek)</div>
                    <textarea
                      value={Array.isArray(config.home?.hero?.backgroundsA) ? config.home.hero.backgroundsA.join('\n') : ''}
                      onChange={(e) => {
                        const urls = e.target.value
                          .split(/\r?\n/g)
                          .map((x) => x.trim())
                          .filter(Boolean);
                        setConfig((p) => ({ ...p, home: { ...(p.home || {}), hero: { ...(p.home?.hero || {}), backgroundsA: urls } } }));
                      }}
                      rows={4}
                      className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
                      placeholder="https://images.unsplash.com/...\nhttps://.../image.jpg"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Backgrounds B (URL na řádek)</div>
                    <textarea
                      value={Array.isArray(config.home?.hero?.backgroundsB) ? config.home.hero.backgroundsB.join('\n') : ''}
                      onChange={(e) => {
                        const urls = e.target.value
                          .split(/\r?\n/g)
                          .map((x) => x.trim())
                          .filter(Boolean);
                        setConfig((p) => ({ ...p, home: { ...(p.home || {}), hero: { ...(p.home?.hero || {}), backgroundsB: urls } } }));
                      }}
                      rows={4}
                      className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
                      placeholder="https://images.unsplash.com/...\nhttps://.../image.jpg"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Hero backgrounds (URL na řádek)</div>
                  <textarea
                    value={Array.isArray(config.home?.hero?.backgrounds) ? config.home.hero.backgrounds.join('\n') : ''}
                    onChange={(e) => {
                      const urls = e.target.value
                        .split(/\r?\n/g)
                        .map((x) => x.trim())
                        .filter(Boolean);
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), hero: { ...(p.home?.hero || {}), backgrounds: urls } } }));
                    }}
                    rows={5}
                    className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
                    placeholder="https://images.unsplash.com/...\nhttps://.../image.jpg"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Instagram URL</div>
                <input
                  value={String(config.home?.instagram?.url || '')}
                  onChange={(e) => setConfig((p) => ({ ...p, home: { ...(p.home || {}), instagram: { ...(p.home?.instagram || {}), url: e.target.value } } }))}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="https://instagram.com/pupenfappz/"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Instagram handle</div>
                <input
                  value={String(config.home?.instagram?.handle || '')}
                  onChange={(e) => setConfig((p) => ({ ...p, home: { ...(p.home || {}), instagram: { ...(p.home?.instagram || {}), handle: e.target.value } } }))}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="@pupenfappz"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {section === 'member' && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-black text-stone-900">Členský portál</div>
            <div className="text-sm text-stone-600 font-medium mt-1">Konfigurace viditelnosti sekcí v členském portálu.</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
              {mpDict.supportEmailLabel || 'Podpora e-mail'}
            </div>
            <input
              value={String((config as any).member_portal?.support_email || '')}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  member_portal: { ...(p as any).member_portal, support_email: e.target.value },
                }))
              }
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              placeholder="info@pupen.org"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
              {mpDict.supportPhoneLabel || 'Podpora telefon'}
            </div>
            <input
              value={String((config as any).member_portal?.support_phone || '')}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  member_portal: { ...(p as any).member_portal, support_phone: e.target.value },
                }))
              }
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              placeholder="+420 123 456 789"
            />
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Provider adres</div>
            <select
              value={String((config as any).member_portal?.address_provider || 'nominatim')}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  member_portal: { ...(p as any).member_portal, address_provider: e.target.value },
                }))
              }
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
            >
              <option value="nominatim">OpenStreetMap (Nominatim)</option>
              <option value="ruian">RÚIAN (ČÚZK)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between bg-stone-50 rounded-2xl border border-stone-100 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Onboarding karta</div>
            <div className="text-xs font-bold text-stone-600 mt-1 truncate">Zobrazovat onboarding v členském portálu.</div>
          </div>
          <button
            type="button"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                member_portal: { ...(p as any).member_portal, show_onboarding: ((p as any).member_portal?.show_onboarding ?? true) ? false : true },
              }))
            }
            className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition ${
              ((config as any).member_portal?.show_onboarding ?? true) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            {((config as any).member_portal?.show_onboarding ?? true) ? 'Zapnuto' : 'Vypnuto'}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {MEMBER_TABS.map((id) => {
            const hidden = Array.isArray((config as any).member_portal?.hidden_tabs) ? (config as any).member_portal.hidden_tabs : [];
            const isHidden = hidden.includes(id);
            const label =
              id === 'dashboard'
                ? dict?.member?.tabDashboard
                : id === 'notifications'
                  ? dict?.member?.tabNotifications
                  : id === 'events'
                    ? dict?.member?.tabEvents
                    : id === 'my_events'
                      ? dict?.member?.tabMyEvents
                      : id === 'documents'
                        ? dict?.member?.tabDocuments
                        : id === 'card'
                          ? dict?.member?.tabCard
                          : id === 'guidelines'
                            ? dict?.member?.tabGuidelines
                            : id === 'articles'
                              ? dict?.member?.tabArticles
                              : id === 'messages'
                                ? dict?.member?.tabMessages
                                : id === 'directory'
                                  ? dict?.member?.tabDirectory
                                  : id === 'projects'
                                    ? dict?.member?.tabProjects
                                    : id === 'polls'
                                      ? dict?.member?.tabPolls
                                      : id === 'governance'
                                        ? dict?.member?.tabGovernance
                                        : id === 'board'
                                          ? dict?.member?.tabBoard
                                          : id === 'settings'
                                            ? dict?.member?.tabSettings
                                            : id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setConfig((p) => {
                    const prevHidden = Array.isArray((p as any).member_portal?.hidden_tabs) ? (p as any).member_portal.hidden_tabs : [];
                    const nextHidden = prevHidden.includes(id) ? prevHidden.filter((x: string) => x !== id) : [...prevHidden, id];
                    return { ...p, member_portal: { ...(p as any).member_portal, hidden_tabs: nextHidden } } as any;
                  });
                }}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition ${
                  isHidden ? 'bg-stone-50 border-stone-200 text-stone-400' : 'bg-white border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isHidden ? 'text-stone-400' : 'text-green-600'}`}>
                  {isHidden ? 'Skryto' : 'Zobrazeno'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 space-y-4">
          <div className="min-w-0">
            <div className="text-sm font-black text-stone-900">{mpDict.directoryFieldsTitle || 'Adresář členů'}</div>
            <div className="text-sm text-stone-600 font-medium mt-1">
              {mpDict.directoryFieldsDesc || 'Nastavte, které údaje se v členském adresáři zobrazují.'}
            </div>
          </div>

          <div className="flex items-center justify-between bg-white rounded-2xl border border-stone-200 px-5 py-4">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                {mpDict.directoryShowMapLabel || 'Zobrazit mapu'}
              </div>
              <div className="text-xs font-bold text-stone-600 mt-1 truncate">
                {mpDict.directoryShowMapDesc || 'Mapa zobrazuje lokace členů po městech.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfig((p) => {
                  const prevDir = ((p as any).member_portal?.directory && typeof (p as any).member_portal.directory === 'object')
                    ? (p as any).member_portal.directory
                    : {};
                  const prev = typeof prevDir.show_map === 'boolean' ? prevDir.show_map : true;
                  return { ...p, member_portal: { ...(p as any).member_portal, directory: { ...prevDir, show_map: !prev } } } as any;
                })
              }
              className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition ${
                (((config as any).member_portal?.directory?.show_map ?? true) ? true : false)
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {((config as any).member_portal?.directory?.show_map ?? true) ? 'Zapnuto' : 'Vypnuto'}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {DIRECTORY_FIELDS.map((f) => {
              const raw = (config as any).member_portal?.directory?.fields;
              const enabled = Array.isArray(raw) ? raw.map(String).includes(f.id) : false;
              const label = f.labelCs;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setConfig((p) => {
                      const prevDir = ((p as any).member_portal?.directory && typeof (p as any).member_portal.directory === 'object')
                        ? (p as any).member_portal.directory
                        : {};
                      const prevFields = Array.isArray(prevDir.fields) ? prevDir.fields.map(String) : [];
                      const nextFields = prevFields.includes(f.id) ? prevFields.filter((x: string) => x !== f.id) : [...prevFields, f.id];
                      return { ...p, member_portal: { ...(p as any).member_portal, directory: { ...prevDir, fields: nextFields } } } as any;
                    })
                  }
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition ${
                    enabled ? 'bg-white border-stone-200 hover:bg-stone-50' : 'bg-stone-50 border-stone-200 text-stone-400'
                  }`}
                >
                  <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${enabled ? 'text-green-600' : 'text-stone-400'}`}>
                    {enabled ? (mpDict.enabled || 'Zobrazeno') : (mpDict.disabled || 'Skryto')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-black text-stone-900">{mpDict.quickLinksTitle || 'Rychlé odkazy'}</div>
              <div className="text-sm text-stone-600 font-medium mt-1">{mpDict.quickLinksDesc || 'Odkazy se zobrazí v členském portálu na nástěnce.'}</div>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfig((p) => {
                  const prev = Array.isArray((p as any).member_portal?.quick_links) ? (p as any).member_portal.quick_links : [];
                  const next = [...prev, { label_cs: '', label_en: '', url: '' }];
                  return { ...p, member_portal: { ...(p as any).member_portal, quick_links: next } } as any;
                })
              }
              className="shrink-0 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
            >
              {mpDict.addLink || 'Přidat odkaz'}
            </button>
          </div>

          <div className="grid gap-3">
            {(Array.isArray((config as any).member_portal?.quick_links) ? (config as any).member_portal.quick_links : []).map((it: any, idx: number) => (
              <div key={idx} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{mpDict.quickLinkLabelCs || 'Text (CZ)'}</div>
                    <input
                      value={String(it?.label_cs || '')}
                      onChange={(e) =>
                        setConfig((p) => {
                          const prev = Array.isArray((p as any).member_portal?.quick_links) ? (p as any).member_portal.quick_links : [];
                          const next = prev.map((x: any, i: number) => (i === idx ? { ...(x || {}), label_cs: e.target.value } : x));
                          return { ...p, member_portal: { ...(p as any).member_portal, quick_links: next } } as any;
                        })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{mpDict.quickLinkLabelEn || 'Text (EN)'}</div>
                    <input
                      value={String(it?.label_en || '')}
                      onChange={(e) =>
                        setConfig((p) => {
                          const prev = Array.isArray((p as any).member_portal?.quick_links) ? (p as any).member_portal.quick_links : [];
                          const next = prev.map((x: any, i: number) => (i === idx ? { ...(x || {}), label_en: e.target.value } : x));
                          return { ...p, member_portal: { ...(p as any).member_portal, quick_links: next } } as any;
                        })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{mpDict.quickLinkUrl || 'URL'}</div>
                    <input
                      value={String(it?.url || '')}
                      onChange={(e) =>
                        setConfig((p) => {
                          const prev = Array.isArray((p as any).member_portal?.quick_links) ? (p as any).member_portal.quick_links : [];
                          const next = prev.map((x: any, i: number) => (i === idx ? { ...(x || {}), url: e.target.value } : x));
                          return { ...p, member_portal: { ...(p as any).member_portal, quick_links: next } } as any;
                        })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      placeholder="https://… nebo /…"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((p) => {
                      const prev = Array.isArray((p as any).member_portal?.quick_links) ? (p as any).member_portal.quick_links : [];
                      const next = prev.filter((_: any, i: number) => i !== idx);
                      return { ...p, member_portal: { ...(p as any).member_portal, quick_links: next } } as any;
                    })
                  }
                  className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                >
                  {mpDict.remove || 'Odebrat'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {section === 'pages' && (
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
      )}

      {section === 'content' && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
        <div>
          <div className="text-sm font-black text-stone-900">Obsah stránek</div>
          <div className="text-sm text-stone-600 font-medium mt-1">Bilingvní editor obsahu (CZ/EN). Pokud je obsah prázdný, stránka použije defaultní layout.</div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Stránka</div>
            <select
              value={pageEditorSlug}
              onChange={(e) => setPageEditorSlug(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
            >
              {(['Navbar', 'Nástroje', 'Ostatní', 'CMS'] as const).map((g) => {
                const slugs = contentSlugs.filter((s) => pageMeta.get(s)?.group === g);
                if (!slugs.length) return null;
                return (
                  <optgroup key={g} label={g}>
                    {slugs.map((s) => (
                      <option key={s} value={s}>
                        {pageMeta.get(s)?.label || s} /{s}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setPageCsTitle('');
                setPageCsHtml('');
                setPageEnTitle('');
                setPageEnHtml('');
              }}
              className="w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
            >
              Vyčistit obsah
            </button>
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4 flex flex-wrap items-center gap-2 justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Viditelnost</div>
            <div className="text-xs font-bold text-stone-700 truncate">/{pageEditorSlug}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/cs/${pageEditorSlug}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
            >
              Otevřít (CZ)
            </a>
            <a
              href={`/en/${pageEditorSlug}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
            >
              Otevřít (EN)
            </a>
            {(() => {
              const cfg = config.pages?.[pageEditorSlug] || {};
              const meta = pageMeta.get(pageEditorSlug);
              return (
                <>
                  <button
                    type="button"
                    onClick={() => updatePage(pageEditorSlug, { enabled: cfg.enabled === false ? true : false })}
                    className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                      cfg.enabled === false
                        ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        : 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                    }`}
                  >
                    {cfg.enabled === false ? 'Skryto' : 'Zobrazeno'}
                  </button>
                  {meta?.group === 'Navbar' ? (
                    <button
                      type="button"
                      onClick={() => updatePage(pageEditorSlug, { navbar: cfg.navbar === false ? true : false })}
                      className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                        cfg.navbar === false
                          ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                      }`}
                    >
                      {cfg.navbar === false ? 'Mimo navbar' : 'V navbaru'}
                    </button>
                  ) : null}
                  {meta?.group === 'Nástroje' ? (
                    <button
                      type="button"
                      onClick={() => updatePage(pageEditorSlug, { tools: cfg.tools === false ? true : false })}
                      className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                        cfg.tools === false
                          ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                      }`}
                    >
                      {cfg.tools === false ? 'Mimo nástroje' : 'V nástrojích'}
                    </button>
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>

        {pageEditorLoading ? (
          <div className="flex items-center justify-center p-10">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Titulek (CZ)</div>
              <input
                value={pageCsTitle}
                onChange={(e) => setPageCsTitle(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Obsah (CZ)</div>
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                <Editor value={pageCsHtml} onChange={(v: string) => setPageCsHtml(v)} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Title (EN)</div>
              <input
                value={pageEnTitle}
                onChange={(e) => setPageEnTitle(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Content (EN)</div>
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                <Editor value={pageEnHtml} onChange={(v: string) => setPageEnHtml(v)} />
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
