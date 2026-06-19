'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import { Globe, Save, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { SITE_PAGES } from '@/lib/site/pages-registry';
import { CMS_PAGES } from '@/lib/site/cms-pages-registry';
import SitePageBlocksEditor from '@/app/[lang]/admin/dashboard/components/SitePageBlocksEditor';
import { pageBlocksToHtml, parsePageBlocks, type PageBlocks } from '@/lib/site/page-blocks';
import Popover from '@/app/components/ui/Popover';
import type { Dictionary } from '@/lib/dictionary-types';

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

type Props = { dict: Dictionary; permissions?: any };

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

const DIRECTORY_FIELDS = ['email', 'member_since', 'city', 'member_no', 'address'] as const;

const Editor = dynamic(() => import('../../../components/Editor'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200 dark:bg-stone-900/60 dark:border-stone-800" />
  ),
});

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export default function SiteConfigTab({ dict, permissions }: Props) {
  const { showToast } = useToast();
  const t = dict.admin.siteConfig;
  const mpDict = dict.memberPortalConfig;
  const notSignedInError = t.errors.notSignedIn;
  const requestFailedError = t.errors.requestFailed;
  const genericError = t.errors.generic;
  const isSuperadmin = !!permissions?.can_manage_admins;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<'pages' | 'content' | 'home' | 'member' | 'maintenance' | 'permissions'>('pages');
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
  const [pageCsBlocks, setPageCsBlocks] = useState<PageBlocks>([]);
  const [pageEnBlocks, setPageEnBlocks] = useState<PageBlocks>([]);
  const [pageContentMode, setPageContentMode] = useState<'html' | 'blocks'>('html');

  const [pageAccess, setPageAccess] = useState<{
    loaded: boolean;
    allView: boolean;
    allEdit: boolean;
    viewSlugs: string[];
    editSlugs: string[];
  }>({ loaded: false, allView: false, allEdit: false, viewSlugs: [], editSlugs: [] });

  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permItems, setPermItems] = useState<any[]>([]);
  const [permRoles, setPermRoles] = useState<any[]>([]);

  const [permSlug, setPermSlug] = useState<string>('o-nas');
  const [permTarget, setPermTarget] = useState<'user' | 'role'>('user');
  const [permCanView, setPermCanView] = useState(true);
  const [permCanEdit, setPermCanEdit] = useState(false);

  const [permUserQuery, setPermUserQuery] = useState('');
  const [permUserResults, setPermUserResults] = useState<any[]>([]);
  const [permUserSearching, setPermUserSearching] = useState(false);
  const [permUserOpen, setPermUserOpen] = useState(false);
  const [permSelectedUser, setPermSelectedUser] = useState<any>(null);
  const permUserAnchorRef = useRef<HTMLDivElement>(null);

  const [permRoleId, setPermRoleId] = useState('');

  const canEditSiteNav = isSuperadmin || !!permissions?.can_edit_site_nav;
  const canEditSiteHome = isSuperadmin || !!permissions?.can_edit_site_home;
  const canEditSiteMember = isSuperadmin || !!permissions?.can_edit_site_member_portal;
  const canEditSiteMaintenance = isSuperadmin || !!permissions?.can_edit_site_maintenance;

  const canViewAnyContent =
    isSuperadmin ||
    !!permissions?.can_view_site_pages ||
    !!permissions?.can_edit_site_pages ||
    pageAccess.allView ||
    pageAccess.viewSlugs.length > 0;

  const canEditCurrentPage =
    isSuperadmin || !!permissions?.can_edit_site_pages || pageAccess.allEdit || pageAccess.editSlugs.includes(pageEditorSlug);

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
    const navLabels = nav as unknown as Record<string, unknown>;
    const toolsMap = tools as unknown as Record<string, { title?: unknown }>;
    const map = new Map<string, string>();
    for (const p of DEFAULT_PAGES) {
      if (p.labelKey) {
        const v = navLabels[p.labelKey];
        map.set(p.slug, typeof v === 'string' ? v : p.slug);
      } else if (p.toolKey) {
        const v = toolsMap[p.toolKey]?.title;
        map.set(p.slug, typeof v === 'string' ? v : p.slug);
      } else map.set(p.slug, p.slug);
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
        const shouldLoadConfig = isSuperadmin || canEditSiteNav || canEditSiteHome || canEditSiteMember || canEditSiteMaintenance;
        if (!shouldLoadConfig) {
          if (mounted) setLoading(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error(notSignedInError);
        const res = await fetch('/api/admin/site-config', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || requestFailedError);
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
        showToast(e?.message || genericError, 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [canEditSiteHome, canEditSiteMaintenance, canEditSiteMember, canEditSiteNav, genericError, isSuperadmin, notSignedInError, requestFailedError, showToast]);

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
      if (!token) throw new Error(t.errors.notSignedIn);
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
      if (!res.ok) throw new Error(json?.error || t.errors.saveFailed);
      showToast(t.toasts.saved, 'success');
    } catch (e: any) {
      showToast(e?.message || t.errors.generic, 'error');
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
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error(notSignedInError);
        const res = await fetch('/api/admin/site-pages/allowed', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error || genericError);
        setPageAccess({
          loaded: true,
          allView: !!json?.allView,
          allEdit: !!json?.allEdit,
          viewSlugs: Array.isArray(json?.viewSlugs) ? json.viewSlugs.map((x: any) => String(x)) : [],
          editSlugs: Array.isArray(json?.editSlugs) ? json.editSlugs.map((x: any) => String(x)) : [],
        });
      } catch {
        if (!alive) return;
        setPageAccess((p) => ({ ...p, loaded: true }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [genericError, notSignedInError]);

  useEffect(() => {
    if (isSuperadmin) return;
    if (canViewAnyContent && section !== 'content') {
      if (!canEditSiteNav && !canEditSiteHome && !canEditSiteMember && !canEditSiteMaintenance) setSection('content');
    }

    const allowed = pageAccess.allView ? contentSlugs : pageAccess.viewSlugs;
    if (allowed.length && !allowed.includes(pageEditorSlug)) {
      setPageEditorSlug(allowed[0]);
    }
  }, [canEditSiteHome, canEditSiteMaintenance, canEditSiteMember, canEditSiteNav, canViewAnyContent, contentSlugs, isSuperadmin, pageAccess.allView, pageAccess.viewSlugs, pageEditorSlug, section]);

  const loadPerms = useCallback(async () => {
    setPermLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(notSignedInError);

      const [permsRes, rolesRes] = await Promise.all([
        fetch('/api/admin/site-pages/permissions', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/roles', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const permsJson = await permsRes.json().catch(() => ({}));
      if (!permsRes.ok) throw new Error(permsJson?.error || genericError);
      setPermItems(Array.isArray(permsJson?.items) ? permsJson.items : []);

      const rolesJson = await rolesRes.json().catch(() => ({}));
      if (rolesRes.ok) {
        setPermRoles(Array.isArray(rolesJson?.roles) ? rolesJson.roles : []);
      } else {
        setPermRoles([]);
      }
    } finally {
      setPermLoading(false);
    }
  }, [genericError, notSignedInError]);

  useEffect(() => {
    if (!isSuperadmin) return;
    if (section !== 'permissions') return;
    loadPerms().catch(() => null);
  }, [isSuperadmin, loadPerms, section]);

  useEffect(() => {
    if (!isSuperadmin) return;
    if (section !== 'permissions') return;
    if (permTarget !== 'user') return;
    if (permSelectedUser) return;
    const q = String(permUserQuery || '').trim();
    if (q.length < 2) {
      setPermUserResults([]);
      setPermUserSearching(false);
      return;
    }
    let cancelled = false;
    setPermUserSearching(true);
    const tmr = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error(notSignedInError);
        const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(q)}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || genericError);
        if (cancelled) return;
        setPermUserResults(Array.isArray(json?.users) ? json.users : []);
      } catch {
        if (cancelled) return;
        setPermUserResults([]);
      } finally {
        if (cancelled) return;
        setPermUserSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [genericError, isSuperadmin, notSignedInError, permSelectedUser, permTarget, permUserQuery, section]);

  const savePerm = useCallback(async () => {
    if (!isSuperadmin) return;
    const slug = String(permSlug || '').trim();
    if (!slug) return;
    if (permTarget === 'user' && !permSelectedUser?.id) return;
    if (permTarget === 'role' && !permRoleId) return;

    setPermSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(notSignedInError);
      const res = await fetch('/api/admin/site-pages/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug,
          userId: permTarget === 'user' ? String(permSelectedUser.id) : null,
          roleId: permTarget === 'role' ? String(permRoleId) : null,
          canView: permCanView,
          canEdit: permCanEdit,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || genericError);
      await loadPerms();
    } finally {
      setPermSaving(false);
    }
  }, [genericError, isSuperadmin, loadPerms, notSignedInError, permCanEdit, permCanView, permRoleId, permSelectedUser, permSlug, permTarget]);

  const removePerm = useCallback(
    async (row: any) => {
      if (!isSuperadmin) return;
      const slug = String(row?.page_slug || '').trim();
      const userId = row?.user_id ? String(row.user_id) : null;
      const roleId = row?.role_id ? String(row.role_id) : null;
      if (!slug || (!userId && !roleId)) return;

      setPermSaving(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error(notSignedInError);
        const res = await fetch('/api/admin/site-pages/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ slug, userId, roleId, canView: false, canEdit: false }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || genericError);
        await loadPerms();
      } finally {
        setPermSaving(false);
      }
    },
    [genericError, isSuperadmin, loadPerms, notSignedInError],
  );

  useEffect(() => {
    if (!canViewAnyContent) return;
    if (!isSuperadmin && section !== 'content') return;
    let alive = true;
    (async () => {
      setPageEditorLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error(notSignedInError);
        const res = await fetch(`/api/admin/site-pages/${encodeURIComponent(pageEditorSlug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || genericError);
        const items = Array.isArray(json?.items) ? json.items : [];
        const cs = items.find((x: any) => x?.lang === 'cs') || null;
        const en = items.find((x: any) => x?.lang === 'en') || null;
        if (!alive) return;
        const hasBlocks = Array.isArray(cs?.content_blocks) || Array.isArray(en?.content_blocks);
        setPageCsTitle(String(cs?.title || ''));
        setPageCsHtml(String(cs?.content_html || ''));
        setPageEnTitle(String(en?.title || ''));
        setPageEnHtml(String(en?.content_html || ''));
        setPageCsBlocks(parsePageBlocks(cs?.content_blocks) || []);
        setPageEnBlocks(parsePageBlocks(en?.content_blocks) || []);
        setPageContentMode(hasBlocks ? 'blocks' : 'html');
      } catch (e: any) {
        if (!alive) return;
        showToast(e?.message || genericError, 'error');
      } finally {
        if (alive) setPageEditorLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canViewAnyContent, genericError, isSuperadmin, notSignedInError, pageEditorSlug, section, showToast]);

  const savePageContent = async () => {
    setPageEditorSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(t.errors.notSignedIn);
      const csBlocksPayload = pageCsBlocks.length ? pageCsBlocks : null;
      const enBlocksPayload = pageEnBlocks.length ? pageEnBlocks : null;
      const contentBody =
        pageContentMode === 'blocks'
          ? {
              cs: {
                title: pageCsTitle,
                content_blocks: csBlocksPayload,
                content_html: csBlocksPayload ? pageBlocksToHtml(csBlocksPayload) : null,
              },
              en: {
                title: pageEnTitle,
                content_blocks: enBlocksPayload,
                content_html: enBlocksPayload ? pageBlocksToHtml(enBlocksPayload) : null,
              },
            }
          : {
              cs: { title: pageCsTitle, content_html: pageCsHtml, content_blocks: null },
              en: { title: pageEnTitle, content_html: pageEnHtml, content_blocks: null },
            };
      const res = await fetch(`/api/admin/site-pages/${encodeURIComponent(pageEditorSlug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(contentBody),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || t.errors.saveFailed);
      showToast(t.toasts.contentSaved, 'success');
    } catch (e: any) {
      showToast(e?.message || t.errors.generic, 'error');
    } finally {
      setPageEditorSaving(false);
    }
  };

  const canSaveSection =
    section === 'content'
      ? canEditCurrentPage
      : section === 'pages'
        ? canEditSiteNav
        : section === 'home'
          ? canEditSiteHome
          : section === 'member'
            ? canEditSiteMember
            : section === 'maintenance'
              ? canEditSiteMaintenance
              : section === 'permissions'
                ? isSuperadmin
                : false;

  const availableContentSlugs = isSuperadmin
    ? contentSlugs
    : pageAccess.allView
      ? contentSlugs
      : contentSlugs.filter((s) => pageAccess.viewSlugs.includes(s));

  const permGrouped = useMemo(() => {
    const bySlug = new Map<string, any[]>();
    for (const it of permItems) {
      const slug = String((it as any)?.page_slug || '').trim();
      if (!slug) continue;
      const prev = bySlug.get(slug);
      if (prev) prev.push(it);
      else bySlug.set(slug, [it]);
    }
    const out = Array.from(bySlug.entries()).map(([slug, items]) => ({ slug, items }));
    out.sort((a, b) => a.slug.localeCompare(b.slug));
    return out;
  }, [permItems]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between dark:bg-stone-950 dark:border-stone-800">
        <h2 className="text-xl font-bold flex items-center gap-3 dark:text-stone-100">
          <Globe className="text-green-600" />
          {dict.admin.tabSitePages}
        </h2>
        {section === 'content' ? (
          <button
            type="button"
            onClick={savePageContent}
            disabled={pageEditorSaving || pageEditorLoading || !canSaveSection}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {pageEditorSaving ? <InlinePulse className="bg-white/80" size={16} /> : <Save size={16} />}
            {t.buttons.saveContent}
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={saving || !canSaveSection}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? <InlinePulse className="bg-white/80" size={16} /> : <Save size={16} />}
            {t.buttons.saveSettings}
          </button>
        )}
      </div>

      <div className="bg-white p-2 rounded-[2rem] border shadow-sm dark:bg-stone-950 dark:border-stone-800">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['content', t.sections.content, canViewAnyContent],
              ['pages', t.sections.navigation, canEditSiteNav],
              ['home', t.sections.home, canEditSiteHome],
              ['member', t.sections.memberPortal, canEditSiteMember],
              ['maintenance', t.sections.maintenance, canEditSiteMaintenance],
              ['permissions', t.sections.permissions, isSuperadmin],
            ] as const
          )
            .filter(([, , visible]) => visible)
            .map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSection(k as any)}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                section === k
                  ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === 'maintenance' && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 dark:bg-stone-950 dark:border-stone-800">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-black text-stone-900 flex items-center gap-2 dark:text-stone-100">
              <ShieldAlert className="text-orange-500" size={18} />
              {t.maintenance.title}
            </div>
            <div className="text-sm text-stone-600 font-medium mt-1 dark:text-stone-300">{t.maintenance.subtitle}</div>
          </div>
          <button
            type="button"
            onClick={() => setConfig((p) => ({ ...p, maintenance_enabled: !p.maintenance_enabled }))}
            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
              config.maintenance_enabled
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
            }`}
          >
            {config.maintenance_enabled ? t.common.enabled : t.common.disabled}
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.maintenance.start}</div>
            <input
              type="datetime-local"
              value={toLocalInput(config.maintenance_start_at)}
              onChange={(e) => {
                const v = e.target.value;
                setConfig((p) => ({ ...p, maintenance_start_at: v ? new Date(v).toISOString() : null }));
              }}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.maintenance.end}</div>
            <input
              type="datetime-local"
              value={toLocalInput(config.maintenance_end_at)}
              onChange={(e) => {
                const v = e.target.value;
                setConfig((p) => ({ ...p, maintenance_end_at: v ? new Date(v).toISOString() : null }));
              }}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, maintenance_start_at: null, maintenance_end_at: null }))}
              className="w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
            >
              {t.maintenance.clearTime}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.maintenance.titleCs}</div>
            <input
              value={config.maintenance_title_cs || ''}
              onChange={(e) => setConfig((p) => ({ ...p, maintenance_title_cs: e.target.value }))}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
              placeholder={t.maintenance.titleCsPlaceholder}
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.maintenance.titleEn}</div>
            <input
              value={config.maintenance_title_en || ''}
              onChange={(e) => setConfig((p) => ({ ...p, maintenance_title_en: e.target.value }))}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
              placeholder={t.maintenance.titleEnPlaceholder}
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.maintenance.bodyCs}</div>
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden dark:bg-stone-950 dark:border-stone-800">
              <Editor value={config.maintenance_body_cs || ''} onChange={(v: string) => setConfig((p) => ({ ...p, maintenance_body_cs: v }))} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.maintenance.bodyEn}</div>
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden dark:bg-stone-950 dark:border-stone-800">
              <Editor value={config.maintenance_body_en || ''} onChange={(v: string) => setConfig((p) => ({ ...p, maintenance_body_en: v }))} />
            </div>
          </div>
        </div>
      </div>
      )}

      {section === 'home' && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 dark:bg-stone-950 dark:border-stone-800">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-black text-stone-900 dark:text-stone-100">{t.home.title}</div>
            <div className="text-sm text-stone-600 font-medium mt-1 dark:text-stone-300">{t.home.subtitle}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {(['hero', 'countdown', 'about', 'news', 'poll', 'testimonials', 'instagram', 'partners', 'newsletter', 'cta'] as const).map((k) => {
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
                    enabled
                      ? 'bg-white border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:border-stone-800 dark:hover:bg-stone-900/60'
                      : 'bg-stone-50 border-stone-200 text-stone-400 dark:bg-stone-900/60 dark:border-stone-800 dark:text-stone-500'
                  }`}
                >
                  <span className="font-black text-[11px] uppercase tracking-widest">{t.home.widgets[k]}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${enabled ? 'text-green-600' : 'text-stone-400'}`}>
                    {enabled ? t.common.shown : t.common.hidden}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-5">
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden dark:bg-stone-950 dark:border-stone-800">
              <div className="p-5 border-b border-stone-100 dark:border-stone-800">
                <div className="text-sm font-black text-stone-900 dark:text-stone-100">{t.home.testimonials.title}</div>
                <div className="text-xs text-stone-500 font-medium mt-1 dark:text-stone-400">{t.home.testimonials.subtitle}</div>
              </div>
              <div className="p-5 grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 dark:text-stone-500">{t.common.czHtml}</div>
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
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 dark:text-stone-500">{t.common.enHtml}</div>
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

            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden dark:bg-stone-950 dark:border-stone-800">
              <div className="p-5 border-b border-stone-100 dark:border-stone-800">
                <div className="text-sm font-black text-stone-900 dark:text-stone-100">{t.home.cta.title}</div>
                <div className="text-xs text-stone-500 font-medium mt-1 dark:text-stone-400">{t.home.cta.subtitle}</div>
              </div>
              <div className="p-5 grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.badgeCsLabel}</div>
                  <input
                    value={String((config.home as any)?.cta?.badge_cs || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), badge_cs: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.titleCsLabel}</div>
                  <input
                    value={String((config.home as any)?.cta?.title_cs || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), title_cs: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.subCsLabel}</div>
                  <input
                    value={String((config.home as any)?.cta?.sub_cs || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), sub_cs: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.primaryLabelCsLabel}</div>
                      <input
                        value={String((config.home as any)?.cta?.primary_label_cs || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), primary_label_cs: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.secondaryLabelCsLabel}</div>
                      <input
                        value={String((config.home as any)?.cta?.secondary_label_cs || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), secondary_label_cs: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.badgeEnLabel}</div>
                  <input
                    value={String((config.home as any)?.cta?.badge_en || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), badge_en: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.titleEnLabel}</div>
                  <input
                    value={String((config.home as any)?.cta?.title_en || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), title_en: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.subEnLabel}</div>
                  <input
                    value={String((config.home as any)?.cta?.sub_en || '')}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), sub_en: e.target.value } } }))
                    }
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.primaryLabelEnLabel}</div>
                      <input
                        value={String((config.home as any)?.cta?.primary_label_en || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), primary_label_en: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.secondaryLabelEnLabel}</div>
                      <input
                        value={String((config.home as any)?.cta?.secondary_label_en || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), secondary_label_en: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.primaryHrefLabel}</div>
                      <input
                        value={String((config.home as any)?.cta?.primary_href || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), primary_href: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                        placeholder={t.home.cta.primaryHrefPlaceholder}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.cta.secondaryHrefLabel}</div>
                      <input
                        value={String((config.home as any)?.cta?.secondary_href || '')}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            home: { ...(p.home || {}), cta: { ...((p.home as any)?.cta || {}), secondary_href: e.target.value } },
                          }))
                        }
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                        placeholder={t.home.cta.secondaryHrefPlaceholder}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.heroAb.title}</div>
                <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300">
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
                  {t.common.enabled}
                </label>
              </div>

              {!!config.home?.hero?.ab?.enabled ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.heroAb.splitALabel}</div>
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
                      className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none dark:bg-stone-900/60 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.heroAb.backgroundsALabel}</div>
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
                      className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none dark:bg-stone-900/60 dark:text-stone-100"
                      placeholder="https://images.unsplash.com/...\nhttps://.../image.jpg"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.heroAb.backgroundsBLabel}</div>
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
                      className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none dark:bg-stone-900/60 dark:text-stone-100"
                      placeholder="https://images.unsplash.com/...\nhttps://.../image.jpg"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.heroAb.heroBackgroundsLabel}</div>
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
                    className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none dark:bg-stone-900/60 dark:text-stone-100"
                    placeholder="https://images.unsplash.com/...\nhttps://.../image.jpg"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.instagram.urlLabel}</div>
                <input
                  value={String(config.home?.instagram?.url || '')}
                  onChange={(e) => setConfig((p) => ({ ...p, home: { ...(p.home || {}), instagram: { ...(p.home?.instagram || {}), url: e.target.value } } }))}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                  placeholder="https://instagram.com/pupenfappz/"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.home.instagram.handleLabel}</div>
                <input
                  value={String(config.home?.instagram?.handle || '')}
                  onChange={(e) => setConfig((p) => ({ ...p, home: { ...(p.home || {}), instagram: { ...(p.home?.instagram || {}), handle: e.target.value } } }))}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                  placeholder="@pupenfappz"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {section === 'member' && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 dark:bg-stone-950 dark:border-stone-800">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-black text-stone-900 dark:text-stone-100">{t.member.title}</div>
            <div className="text-sm text-stone-600 font-medium mt-1 dark:text-stone-300">{t.member.subtitle}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{mpDict.supportEmailLabel}</div>
            <input
              value={String((config as any).member_portal?.support_email || '')}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  member_portal: { ...(p as any).member_portal, support_email: e.target.value },
                }))
              }
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
              placeholder="info@pupen.org"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{mpDict.supportPhoneLabel}</div>
            <input
              value={String((config as any).member_portal?.support_phone || '')}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  member_portal: { ...(p as any).member_portal, support_phone: e.target.value },
                }))
              }
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
              placeholder="+420 123 456 789"
            />
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.member.addressProviderLabel}</div>
            <select
              value={String((config as any).member_portal?.address_provider || 'nominatim')}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  member_portal: { ...(p as any).member_portal, address_provider: e.target.value },
                }))
              }
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
            >
              <option value="nominatim">OpenStreetMap (Nominatim)</option>
              <option value="ruian">RÚIAN (ČÚZK)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between bg-stone-50 rounded-2xl border border-stone-100 px-5 py-4 dark:bg-stone-900/60 dark:border-stone-800">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">{t.member.onboarding.title}</div>
            <div className="text-xs font-bold text-stone-600 mt-1 truncate dark:text-stone-300">{t.member.onboarding.subtitle}</div>
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
              ((config as any).member_portal?.show_onboarding ?? true)
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
            }`}
          >
            {((config as any).member_portal?.show_onboarding ?? true) ? t.common.enabled : t.common.disabled}
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
                  isHidden
                    ? 'bg-stone-50 border-stone-200 text-stone-400 dark:bg-stone-900/60 dark:border-stone-800 dark:text-stone-500'
                    : 'bg-white border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:border-stone-800 dark:hover:bg-stone-900/60'
                }`}
              >
                <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isHidden ? 'text-stone-400' : 'text-green-600'}`}>
                  {isHidden ? t.common.hidden : t.common.shown}
                </span>
              </button>
            );
          })}
        </div>

        <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 space-y-4 dark:bg-stone-900/60 dark:border-stone-800">
          <div className="min-w-0">
            <div className="text-sm font-black text-stone-900 dark:text-stone-100">{mpDict.directoryFieldsTitle}</div>
            <div className="text-sm text-stone-600 font-medium mt-1 dark:text-stone-300">{mpDict.directoryFieldsDesc}</div>
          </div>

          <div className="flex items-center justify-between bg-white rounded-2xl border border-stone-200 px-5 py-4 dark:bg-stone-950 dark:border-stone-800">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">{mpDict.directoryShowMapLabel}</div>
              <div className="text-xs font-bold text-stone-600 mt-1 truncate dark:text-stone-300">{mpDict.directoryShowMapDesc}</div>
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
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
              }`}
            >
              {((config as any).member_portal?.directory?.show_map ?? true) ? t.common.enabled : t.common.disabled}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {DIRECTORY_FIELDS.map((f) => {
              const raw = (config as any).member_portal?.directory?.fields;
              const id = String(f);
              const enabled = Array.isArray(raw) ? raw.map(String).includes(id) : false;
              const label =
                id === 'email'
                  ? dict.common.email
                  : id === 'member_since'
                    ? dict.member.memberSince
                    : id === 'city'
                      ? dict.memberDirectory.city
                      : id === 'member_no'
                        ? dict.memberDirectory.memberNo
                        : id === 'address'
                          ? dict.memberDirectory.address
                          : id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setConfig((p) => {
                      const prevDir = ((p as any).member_portal?.directory && typeof (p as any).member_portal.directory === 'object')
                        ? (p as any).member_portal.directory
                        : {};
                      const prevFields = Array.isArray(prevDir.fields) ? prevDir.fields.map(String) : [];
                      const nextFields = prevFields.includes(id) ? prevFields.filter((x: string) => x !== id) : [...prevFields, id];
                      return { ...p, member_portal: { ...(p as any).member_portal, directory: { ...prevDir, fields: nextFields } } } as any;
                    })
                  }
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition ${
                    enabled
                      ? 'bg-white border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:border-stone-800 dark:hover:bg-stone-900/60'
                      : 'bg-stone-50 border-stone-200 text-stone-400 dark:bg-stone-900/60 dark:border-stone-800 dark:text-stone-500'
                  }`}
                >
                  <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${enabled ? 'text-green-600' : 'text-stone-400'}`}>
                    {enabled ? mpDict.enabled : mpDict.disabled}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 space-y-4 dark:bg-stone-900/60 dark:border-stone-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-black text-stone-900 dark:text-stone-100">{mpDict.quickLinksTitle}</div>
              <div className="text-sm text-stone-600 font-medium mt-1 dark:text-stone-300">{mpDict.quickLinksDesc}</div>
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
              className="shrink-0 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
            >
              {mpDict.addLink}
            </button>
          </div>

          <div className="grid gap-3">
            {(Array.isArray((config as any).member_portal?.quick_links) ? (config as any).member_portal.quick_links : []).map((it: any, idx: number) => (
              <div key={idx} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 dark:bg-stone-950 dark:border-stone-800">
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{mpDict.quickLinkLabelCs}</div>
                    <input
                      value={String(it?.label_cs || '')}
                      onChange={(e) =>
                        setConfig((p) => {
                          const prev = Array.isArray((p as any).member_portal?.quick_links) ? (p as any).member_portal.quick_links : [];
                          const next = prev.map((x: any, i: number) => (i === idx ? { ...(x || {}), label_cs: e.target.value } : x));
                          return { ...p, member_portal: { ...(p as any).member_portal, quick_links: next } } as any;
                        })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{mpDict.quickLinkLabelEn}</div>
                    <input
                      value={String(it?.label_en || '')}
                      onChange={(e) =>
                        setConfig((p) => {
                          const prev = Array.isArray((p as any).member_portal?.quick_links) ? (p as any).member_portal.quick_links : [];
                          const next = prev.map((x: any, i: number) => (i === idx ? { ...(x || {}), label_en: e.target.value } : x));
                          return { ...p, member_portal: { ...(p as any).member_portal, quick_links: next } } as any;
                        })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{mpDict.quickLinkUrl}</div>
                    <input
                      value={String(it?.url || '')}
                      onChange={(e) =>
                        setConfig((p) => {
                          const prev = Array.isArray((p as any).member_portal?.quick_links) ? (p as any).member_portal.quick_links : [];
                          const next = prev.map((x: any, i: number) => (i === idx ? { ...(x || {}), url: e.target.value } : x));
                          return { ...p, member_portal: { ...(p as any).member_portal, quick_links: next } } as any;
                        })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
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
                  className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40 dark:hover:bg-red-950/60"
                >
                  {mpDict.remove}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {section === 'pages' && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8 dark:bg-stone-950 dark:border-stone-800">
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <InlinePulse className="bg-stone-200 dark:bg-stone-800" size={18} />
          </div>
        ) : (
          Object.entries(grouped).map(([groupName, pages]) => {
            const groupLabel =
              groupName === 'Navbar'
                ? t.pages.groups.navbar
                : groupName === 'Nástroje'
                  ? t.pages.groups.tools
                  : groupName === 'Ostatní'
                    ? t.pages.groups.other
                    : groupName === 'CMS'
                      ? t.pages.groups.cms
                      : groupName;
            return (
            <div key={groupName} className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{groupLabel}</div>
              <div className="grid gap-3">
                {pages.map((p) => {
                  const cfg = config.pages?.[p.slug] || {};
                  return (
                    <div
                      key={p.slug}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-stone-50 rounded-[2rem] border border-stone-100 dark:bg-stone-900/60 dark:border-stone-800"
                    >
                      <div className="min-w-0">
                        <div className="font-black text-stone-900 truncate dark:text-stone-100">{pageLabel.get(p.slug)}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1 dark:text-stone-500">/{p.slug}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updatePage(p.slug, { enabled: cfg.enabled === false ? true : false })}
                          className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                            cfg.enabled === false
                              ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                              : 'bg-green-600 text-white border-green-600 hover:bg-green-700 dark:bg-green-500 dark:border-green-500 dark:hover:bg-green-600'
                          }`}
                        >
                          {cfg.enabled === false ? t.common.hidden : t.common.shown}
                        </button>
                        {p.group === 'Navbar' && (
                          <button
                            type="button"
                            onClick={() => updatePage(p.slug, { navbar: cfg.navbar === false ? true : false })}
                            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                              cfg.navbar === false
                                ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                                : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 dark:hover:bg-stone-200'
                            }`}
                          >
                            {cfg.navbar === false ? t.pages.navbarOff : t.pages.navbarOn}
                          </button>
                        )}
                        {p.group === 'Nástroje' && (
                          <button
                            type="button"
                            onClick={() => updatePage(p.slug, { tools: cfg.tools === false ? true : false })}
                            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                              cfg.tools === false
                                ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                                : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 dark:hover:bg-stone-200'
                            }`}
                          >
                            {cfg.tools === false ? t.pages.toolsOff : t.pages.toolsOn}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })
        )}
      </div>
      )}

      {section === 'content' && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 dark:bg-stone-950 dark:border-stone-800">
        <div>
          <div className="text-sm font-black text-stone-900 dark:text-stone-100">{t.content.title}</div>
          <div className="text-sm text-stone-600 font-medium mt-1 dark:text-stone-300">{t.content.subtitle}</div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.content.pageLabel}</div>
            <select
              value={pageEditorSlug}
              onChange={(e) => setPageEditorSlug(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
            >
              {(['Navbar', 'Nástroje', 'Ostatní', 'CMS'] as const).map((g) => {
                const slugs = availableContentSlugs.filter((s) => pageMeta.get(s)?.group === g);
                if (!slugs.length) return null;
                const label =
                  g === 'Navbar' ? t.pages.groups.navbar : g === 'Nástroje' ? t.pages.groups.tools : g === 'Ostatní' ? t.pages.groups.other : t.pages.groups.cms;
                return (
                  <optgroup key={g} label={label}>
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
                setPageCsBlocks([]);
                setPageEnBlocks([]);
                setPageContentMode('html');
              }}
              className="w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
            >
              {t.content.clear}
            </button>
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4 flex flex-wrap items-center gap-2 justify-between dark:bg-stone-900/60 dark:border-stone-800">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">{t.content.visibilityLabel}</div>
            <div className="text-xs font-bold text-stone-700 truncate dark:text-stone-200">/{pageEditorSlug}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/cs/${pageEditorSlug}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
            >
              {t.content.openCs}
            </a>
            <a
              href={`/en/${pageEditorSlug}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
            >
              {t.content.openEn}
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
                        ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                        : 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                    }`}
                  >
                    {cfg.enabled === false ? t.common.hidden : t.common.shown}
                  </button>
                  {meta?.group === 'Navbar' ? (
                    <button
                      type="button"
                      onClick={() => updatePage(pageEditorSlug, { navbar: cfg.navbar === false ? true : false })}
                      className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                        cfg.navbar === false
                          ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                          : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 dark:hover:bg-stone-200'
                      }`}
                    >
                      {cfg.navbar === false ? t.pages.navbarOff : t.pages.navbarOn}
                    </button>
                  ) : null}
                  {meta?.group === 'Nástroje' ? (
                    <button
                      type="button"
                      onClick={() => updatePage(pageEditorSlug, { tools: cfg.tools === false ? true : false })}
                      className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                        cfg.tools === false
                          ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                          : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 dark:hover:bg-stone-200'
                      }`}
                    >
                      {cfg.tools === false ? t.pages.toolsOff : t.pages.toolsOn}
                    </button>
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 dark:bg-stone-900/60 dark:border-stone-800">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">{t.content.editorLabel}</div>
            <div className="text-xs font-bold text-stone-700 truncate dark:text-stone-200">
              {pageContentMode === 'blocks' ? t.content.modeBlocks : t.content.modeHtml}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPageContentMode('html');
                setPageCsHtml((prev) => (prev.trim() ? prev : pageCsBlocks.length ? pageBlocksToHtml(pageCsBlocks) : ''));
                setPageEnHtml((prev) => (prev.trim() ? prev : pageEnBlocks.length ? pageBlocksToHtml(pageEnBlocks) : ''));
              }}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                pageContentMode === 'html'
                  ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
              }`}
            >
              {t.content.modeHtml}
            </button>
            <button
              type="button"
              onClick={() => {
                setPageContentMode('blocks');
                setPageCsBlocks((prev) => (prev.length ? prev : pageCsHtml.trim() ? [{ id: newId(), type: 'rich_text', html: pageCsHtml }] : []));
                setPageEnBlocks((prev) => (prev.length ? prev : pageEnHtml.trim() ? [{ id: newId(), type: 'rich_text', html: pageEnHtml }] : []));
              }}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                pageContentMode === 'blocks'
                  ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
              }`}
            >
              {t.content.modeBlocks}
            </button>
          </div>
        </div>

        {pageEditorLoading ? (
          <div className="flex items-center justify-center p-10">
            <InlinePulse className="bg-stone-200 dark:bg-stone-800" size={18} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.content.titleCsLabel}</div>
              <input
                value={pageCsTitle}
                onChange={(e) => setPageCsTitle(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
              />
              {pageContentMode === 'blocks' ? (
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.content.blocksCsLabel}</div>
                  <SitePageBlocksEditor blocks={pageCsBlocks} onChange={setPageCsBlocks} disabled={pageEditorSaving} />
                </div>
              ) : (
                <>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.content.htmlCsLabel}</div>
                  <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden dark:bg-stone-950 dark:border-stone-800">
                    <Editor value={pageCsHtml} onChange={(v: string) => setPageCsHtml(v)} />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.content.titleEnLabel}</div>
              <input
                value={pageEnTitle}
                onChange={(e) => setPageEnTitle(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
              />
              {pageContentMode === 'blocks' ? (
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.content.blocksEnLabel}</div>
                  <SitePageBlocksEditor blocks={pageEnBlocks} onChange={setPageEnBlocks} disabled={pageEditorSaving} />
                </div>
              ) : (
                <>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.content.htmlEnLabel}</div>
                  <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden dark:bg-stone-950 dark:border-stone-800">
                    <Editor value={pageEnHtml} onChange={(v: string) => setPageEnHtml(v)} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {section === 'permissions' && isSuperadmin && (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 dark:bg-stone-950 dark:border-stone-800">
        <div>
          <div className="text-sm font-black text-stone-900 dark:text-stone-100">{t.permissions.title}</div>
          <div className="text-sm text-stone-600 font-medium mt-1 dark:text-stone-300">{t.permissions.subtitle}</div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 items-end">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.permissions.pageLabel}</div>
            <select
              value={permSlug}
              onChange={(e) => setPermSlug(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
            >
              {contentSlugs.map((s) => (
                <option key={s} value={s}>
                  {pageMeta.get(s)?.label || s} /{s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.permissions.targetLabel}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPermTarget('user');
                  setPermRoleId('');
                }}
                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                  permTarget === 'user'
                    ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                }`}
              >
                {t.permissions.targetUser}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPermTarget('role');
                  setPermSelectedUser(null);
                  setPermUserQuery('');
                  setPermUserResults([]);
                }}
                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                  permTarget === 'role'
                    ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                }`}
              >
                {t.permissions.targetRole}
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 dark:text-stone-500">{t.permissions.permissionLabel}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPermCanView((prev) => {
                    const next = !prev;
                    if (!next) setPermCanEdit(false);
                    return next;
                  })
                }
                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                  permCanView
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                }`}
              >
                VIEW
              </button>
              <button
                type="button"
                onClick={() =>
                  setPermCanEdit((prev) => {
                    const next = !prev;
                    if (next) setPermCanView(true);
                    return next;
                  })
                }
                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                  permCanEdit
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60'
                }`}
              >
                EDIT
              </button>
              <button
                type="button"
                disabled={
                  permSaving ||
                  permLoading ||
                  !permSlug ||
                  (permTarget === 'user' ? !permSelectedUser?.id : !permRoleId) ||
                  (!permCanView && !permCanEdit)
                }
                onClick={savePerm}
                className="ml-auto px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-stone-900 text-white border-stone-900 hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 dark:hover:bg-stone-200"
              >
                {permSaving ? <InlinePulse className="bg-white/80" size={14} /> : <ShieldCheck size={16} />} {dict.common.save}
              </button>
            </div>
          </div>
        </div>

        {permTarget === 'user' ? (
          <div className="grid lg:grid-cols-3 gap-4 items-end">
            <div className="lg:col-span-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Uživatel</div>
              <div className="relative" ref={permUserAnchorRef}>
                <input
                  value={
                    permSelectedUser
                      ? `${String(permSelectedUser.first_name || '').trim()} ${String(permSelectedUser.last_name || '').trim()}`.trim() ||
                        String(permSelectedUser.email || '').trim()
                      : permUserQuery
                  }
                  onChange={(e) => {
                    setPermSelectedUser(null);
                    setPermUserQuery(e.target.value);
                    setPermUserOpen(true);
                  }}
                  onFocus={() => setPermUserOpen(true)}
                  onBlur={() => setTimeout(() => setPermUserOpen(false), 120)}
                  placeholder={t.permissions.userPlaceholder}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition dark:bg-stone-900/60 dark:text-stone-100"
                />
                {permUserOpen && !permSelectedUser ? (
                  <Popover
                    open={permUserOpen && !permSelectedUser}
                    onClose={() => setPermUserOpen(false)}
                    anchorRef={permUserAnchorRef}
                    placement="bottom-start"
                    offset={8}
                    matchWidth
                    zIndex={200}
                    panelClassName="bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden dark:bg-stone-950 dark:border-stone-800"
                  >
                    {permUserSearching ? (
                      <div className="p-4 text-stone-400 font-bold text-sm dark:text-stone-500">{dict.common.loading}</div>
                    ) : permUserResults.length ? (
                      <div className="max-h-72 overflow-auto">
                        {permUserResults.map((u: any) => {
                          const first = String(u.first_name || '').trim();
                          const last = String(u.last_name || '').trim();
                          const full = `${first} ${last}`.trim() || String(u.email || '').trim();
                          const emailValue = String(u.email || '').trim();
                          return (
                            <button
                              key={String(u.id)}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setPermSelectedUser(u);
                                setPermUserQuery('');
                                setPermUserResults([]);
                                setPermUserOpen(false);
                              }}
                              className="w-full text-left px-5 py-4 hover:bg-stone-50 transition dark:hover:bg-stone-900/60"
                            >
                              <div className="font-black text-stone-900 dark:text-stone-100">{full}</div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1 dark:text-stone-500">{emailValue}</div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-stone-400 font-bold text-sm dark:text-stone-500">{dict.common.noResults}</div>
                    )}
                  </Popover>
                ) : null}
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setPermSelectedUser(null);
                  setPermUserQuery('');
                  setPermUserResults([]);
                }}
                className="w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
              >
                {t.common.clear}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4 items-end">
            <div className="lg:col-span-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Role</div>
              <select
                value={permRoleId}
                onChange={(e) => setPermRoleId(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              >
                <option value="">—</option>
                {permRoles.map((r: any) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {String(r.name || r.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setPermRoleId('')}
                className="w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
              >
                {t.common.clear}
              </button>
            </div>
          </div>
        )}

        {permLoading ? (
          <div className="flex items-center justify-center p-10">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : (
          <div className="space-y-4">
            {permGrouped.map((g) => (
              <div key={g.slug} className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 truncate">{pageMeta.get(g.slug)?.label || g.slug}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">/{g.slug}</div>
                  </div>
                </div>
                <div className="grid gap-2">
                  {g.items.map((row: any) => {
                    const isUser = !!row.user_id;
                    const label = isUser
                      ? `${String(row?.user?.first_name || '').trim()} ${String(row?.user?.last_name || '').trim()}`.trim() ||
                        String(row?.user?.email || row.user_id || '').trim()
                      : String(row?.role?.name || row.role_id || '').trim();
                    return (
                      <div key={String(row.id)} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl px-5 py-4">
                        <div className="min-w-0">
                          <div className="font-black text-stone-900 truncate">
                            {label}{' '}
                            <span className="text-stone-400 font-bold text-xs">
                              {isUser ? '(uživatel)' : '(role)'}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                row?.can_view ? 'bg-green-50 text-green-700 border-green-200' : 'bg-stone-50 text-stone-400 border-stone-200'
                              }`}
                            >
                              VIEW
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                row?.can_edit ? 'bg-green-50 text-green-700 border-green-200' : 'bg-stone-50 text-stone-400 border-stone-200'
                              }`}
                            >
                              EDIT
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={permSaving}
                            onClick={() => removePerm(row)}
                            className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-red-50 text-red-700 border-red-200 hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {g.items.length === 0 ? (
                    <div className="text-sm text-stone-500">—</div>
                  ) : null}
                </div>
              </div>
            ))}
            {permGrouped.length === 0 ? (
              <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">Žádná oprávnění</div>
            ) : null}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
