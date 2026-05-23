'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Search, ChevronDown, ChevronUp, Download, AlertTriangle, Server } from 'lucide-react';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';
import ConfirmModal from '@/app/components/ConfirmModal';
import { useToast } from '@/app/context/ToastContext';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';
import AdminEmptyState from './ui/AdminEmptyState';
import { useDictionary } from '@/app/context/DictionaryContext';

export default function LogsTab({ readOnly }: { readOnly?: boolean }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const dict = useDictionary();
  const t = dict.admin.logs;
  const [source, setSource] = React.useState<'admin' | 'error' | 'server'>('admin');
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState<'all' | 'admin' | 'member' | 'system'>('all');
  const [level, setLevel] = React.useState<'all' | 'error' | 'warning' | 'warn' | 'info'>('all');
  const [category, setCategory] = React.useState('');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [purgeDays, setPurgeDays] = React.useState(90);
  const [purgeModalOpen, setPurgeModalOpen] = React.useState(false);
  const [purgeMessage, setPurgeMessage] = React.useState('');
  const [purgePending, setPurgePending] = React.useState(false);

  const PAGE_SIZE = 100;
  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(t.errors.unauthorized);
    return token;
  };

  const getListUrl = (from: number) => {
    const params = new URLSearchParams();
    params.set('source', source);
    params.set('from', String(from));
    params.set('limit', String(PAGE_SIZE));
    if (q.trim()) params.set('q', q.trim());
    if (level !== 'all') params.set('level', level);
    if (source === 'server' && category.trim()) params.set('category', category.trim());
    return `/api/admin/logs?${params.toString()}`;
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['logs', source, q, type, level, category],
    queryFn: async ({ pageParam }) => {
      const from = typeof pageParam === 'number' ? pageParam : 0;
      const token = await getToken();
      const res = await fetch(getListUrl(from), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || t.errors.generic);
      const items = Array.isArray(json?.items) ? json.items : [];
      return { items, nextFrom: items.length === PAGE_SIZE ? from + PAGE_SIZE : null };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextFrom,
  });

  const items = data?.pages.flatMap((p) => p.items) || [];

  const runPurgeDry = async () => {
    const token = await getToken();
    const body: any = { source, olderThanDays: purgeDays, dryRun: true };
    if (level !== 'all') body.level = level;
    if (source === 'server' && category.trim()) body.category = category.trim();
    const res = await fetch('/api/admin/logs/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || t.errors.generic);
    return json as any;
  };

  const runPurge = async () => {
    const token = await getToken();
    const body: any = { source, olderThanDays: purgeDays, dryRun: false };
    if (level !== 'all') body.level = level;
    if (source === 'server' && category.trim()) body.category = category.trim();
    const res = await fetch('/api/admin/logs/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || t.errors.generic);
    return json as any;
  };

  if (isLoading) return <SkeletonTabContent />;

  const norm = (s: any) => String(s || '').toLowerCase();
  const qq = norm(q);

  const getActorType = (log: any) => {
    const email = norm(log?.admin_email);
    const name = norm(log?.admin_name);
    if (!email && !name) return 'system';
    if (email.includes('webhook') || name.includes('webhook')) return 'system';
    if (name.includes('emailprefs')) return 'member';
    if (email === 'member') return 'member';
    return 'admin';
  };

  const getBadge = (log: any) => {
    const action = norm(log?.action);
    if (action.startsWith('user_')) return { label: t.badges.user, cls: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40' };
    if (action.startsWith('site_config')) return { label: t.badges.web, cls: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40' };
    if (action.startsWith('sos')) return { label: t.badges.sos, cls: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40' };
    if (action.startsWith('lost_') || action.includes('lost'))
      return { label: t.badges.lostFound, cls: 'bg-stone-50 text-stone-700 border-stone-100 dark:bg-stone-900/60 dark:text-stone-200 dark:border-stone-800' };
    if (action.startsWith('fio')) return { label: t.badges.fio, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40' };
    if (action.startsWith('gdpr')) return { label: t.badges.gdpr, cls: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40' };
    return { label: t.badges.other, cls: 'bg-green-50 text-green-700 border-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/40' };
  };

  const filtered = React.useMemo(() => {
    if (source !== 'admin') return items;
    return items.filter((log: any) => {
      const actorType = getActorType(log);
      if (type !== 'all' && actorType !== type) return false;
      if (!qq) return true;
      const hay = [log?.admin_email, log?.admin_name, log?.action, log?.target_id, JSON.stringify(log?.details || {})]
        .map(norm)
        .join(' ');
      return hay.includes(qq);
    });
  }, [items, qq, source, type]);

  const escapeCsv = (value: any) => {
    const s = String(value ?? '');
    if (/[\n\r",]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const exportCsv = () => {
    try {
      if (filtered.length === 0) return;
      const rows =
        source === 'admin'
          ? [
              ['created_at', 'admin_email', 'admin_name', 'action', 'target_id', 'details'],
              ...filtered.map((l: any) => [l.created_at, l.admin_email, l.admin_name, l.action, l.target_id, JSON.stringify(l.details || {})]),
            ]
          : source === 'error'
            ? [
                ['created_at', 'level', 'message', 'url', 'user_id', 'user_agent', 'stack'],
                ...filtered.map((l: any) => [l.created_at, l.level, l.message, l.url, l.user_id, l.user_agent, l.stack]),
              ]
            : [
                ['created_at', 'level', 'category', 'message', 'request_id', 'user_id', 'method', 'url', 'ip', 'user_agent', 'data'],
                ...filtered.map((l: any) => [
                  l.created_at,
                  l.level,
                  l.category,
                  l.message,
                  l.request_id,
                  l.user_id,
                  l.method,
                  l.url,
                  l.ip,
                  l.user_agent,
                  JSON.stringify(l.data || {}),
                ]),
              ];
      const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${source}_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t.exportFailed, 'error');
    }
  };

  const fmt = (template: string, vars: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

  const description =
    source === 'admin'
      ? fmt(t.descriptionAdmin, { filtered: filtered.length, total: items.length })
      : source === 'error'
        ? fmt(t.descriptionError, { filtered: filtered.length, total: items.length })
        : fmt(t.descriptionServer, { filtered: filtered.length, total: items.length });

  return (
    <div className="space-y-6">
      <AdminModuleHeader
        title={t.title}
        description={description}
      />

      <AdminPanel className="p-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-end gap-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex items-center gap-2">
            {(['admin', 'error', 'server'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSource(s);
                  setOpenId(null);
                }}
                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                  source === s
                    ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-300 dark:border-stone-800 dark:hover:bg-stone-900/60'
                }`}
              >
                {s === 'admin' ? t.sourceAdmin : s === 'error' ? t.sourceError : t.sourceServer}
              </button>
            ))}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-2xl px-3 py-2 dark:bg-stone-950 dark:border-stone-800">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">{t.purgeLabel}</div>
              <input
                type="number"
                min={7}
                max={3650}
                value={purgeDays}
                onChange={(e) => setPurgeDays(Number(e.target.value) || 90)}
                className="w-20 bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 dark:bg-stone-900/60 dark:border-stone-800 dark:text-stone-100"
              />
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">{t.purgeDaysSuffix}</div>
              <button
                type="button"
                disabled={purgePending}
                onClick={async () => {
                  try {
                    setPurgePending(true);
                    const dry = await runPurgeDry();
                    const wouldDelete = Number(dry?.wouldDelete || 0);
                    setPurgeMessage(fmt(t.purgeConfirmMessage, { days: Number(dry?.olderThanDays || purgeDays), count: wouldDelete }));
                    setPurgeModalOpen(true);
                  } catch (e: any) {
                    showToast(e?.message || t.errors.generic, 'error');
                  } finally {
                    setPurgePending(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
              >
                {t.purgeLabel}
              </button>
            </div>
          )}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full sm:w-[320px] bg-stone-50 border border-stone-100 rounded-2xl pl-11 pr-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none dark:bg-stone-900/60 dark:border-stone-800 dark:text-stone-100"
            />
          </div>
          {source === 'admin' ? (
            <div className="flex items-center gap-2">
              {(['all', 'admin', 'member', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                    type === t
                      ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-300 dark:border-stone-800 dark:hover:bg-stone-900/60'
                  }`}
                >
                  {t === 'all' ? dict.admin.logs.typeAll : t === 'admin' ? dict.admin.logs.typeAdmins : t === 'member' ? dict.admin.logs.typeMembers : dict.admin.logs.typeSystem}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {(source === 'error' ? (['all', 'error', 'warning', 'info'] as const) : (['all', 'error', 'warn', 'info'] as const)).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLevel(t)}
                  className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                    level === t
                      ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-300 dark:border-stone-800 dark:hover:bg-stone-900/60'
                  }`}
                >
                  {t === 'all'
                    ? dict.admin.logs.levelAll
                    : t === 'error'
                      ? dict.admin.logs.levelError
                      : t === 'warning'
                        ? dict.admin.logs.levelWarning
                        : t === 'warn'
                          ? dict.admin.logs.levelWarn
                          : dict.admin.logs.levelInfo}
                </button>
              ))}
              {source === 'server' && (
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={dict.admin.logs.categoryPlaceholder}
                  className="w-full sm:w-[200px] bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none dark:bg-stone-900/60 dark:border-stone-800 dark:text-stone-100"
                />
              )}
            </div>
          )}
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={exportCsv}
            className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50 flex items-center gap-2 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
          >
            <Download size={16} /> {dict.admin.logs.exportCsv}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <AdminEmptyState
            icon={Search}
            title={dict.admin.logs.emptyTitle}
            description={dict.admin.logs.emptyDesc}
          />
        ) : (
          source === 'admin' ? (
            filtered.map((log: any) => {
              const badge = getBadge(log);
              const isOpen = openId === log.id;
              return (
                <div
                  key={log.id}
                  className="p-5 bg-stone-50 rounded-2xl border border-stone-100 transition hover:bg-white hover:shadow-lg dark:bg-stone-900/60 dark:border-stone-800 dark:hover:bg-stone-950"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shrink-0 shadow-sm font-black uppercase text-xs dark:bg-stone-950 dark:border dark:border-stone-800">
                      {log.admin_name?.[0] || log.admin_email?.[0]}
                    </div>
                    <div className="flex-grow">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-1 gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm dark:text-stone-100">{log.admin_name || log.admin_email}</span>
                          <span className="text-[10px] text-stone-400 font-medium dark:text-stone-500">({log.admin_email})</span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1 shrink-0 dark:text-stone-600">
                          <Clock size={10} /> {new Date(log.created_at).toLocaleString('cs-CZ')}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div className="text-sm text-stone-600 font-medium dark:text-stone-300">
                            <span className="text-stone-400 font-black uppercase tracking-widest text-[10px] mr-2 dark:text-stone-500">{t.actionLabel}</span>
                            <span className="font-black text-stone-900 dark:text-stone-100">{log.action}</span>
                          </div>
                          {log.target_id && (
                            <div className="text-[10px] text-stone-400 font-bold dark:text-stone-500">
                              {t.targetLabel}: <span className="font-black text-stone-600 dark:text-stone-200">{log.target_id}</span>
                            </div>
                          )}
                        </div>

                        {log.details && (
                          <div className="bg-white rounded-xl border border-stone-100 overflow-hidden dark:bg-stone-950 dark:border-stone-800">
                            <button
                              type="button"
                              onClick={() => setOpenId(isOpen ? null : String(log.id))}
                              className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition dark:text-stone-300 dark:hover:bg-stone-900/60"
                            >
                              <span>{t.detailsLabel}</span>
                              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {isOpen && (
                              <pre className="px-4 py-3 text-[11px] text-stone-700 whitespace-pre-wrap break-words font-mono border-t border-stone-100 dark:text-stone-200 dark:border-stone-800">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : source === 'error' ? (
            filtered.map((log: any) => {
              const isOpen = openId === log.id;
              const sev = String(log.level || 'error');
              const sevCls =
                sev === 'error'
                  ? 'bg-red-100 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40'
                  : sev === 'warning'
                    ? 'bg-amber-100 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40'
                    : 'bg-stone-100 text-stone-700 border-stone-100 dark:bg-stone-900/60 dark:text-stone-200 dark:border-stone-800';
              return (
                <AdminPanel key={log.id} className="p-6">
                  <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start">
                    <div className="flex gap-3 items-start">
                      <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${sevCls}`}>
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 break-all dark:text-stone-100">{log.message}</h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {new Date(log.created_at).toLocaleString('cs-CZ')}
                          </span>
                          {log.url && <span className="max-w-[260px] truncate" title={String(log.url)}>{String(log.url)}</span>}
                          {log.user_id && (
                            <span className="flex items-center gap-1">
                              <span className="text-stone-500 dark:text-stone-400">{t.userPrefix}</span> {String(log.user_id)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(log.stack || log.user_agent) && (
                    <div className="mt-4 bg-white rounded-xl border border-stone-100 overflow-hidden dark:bg-stone-950 dark:border-stone-800">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : String(log.id))}
                        className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition dark:text-stone-300 dark:hover:bg-stone-900/60"
                      >
                        <span>{t.detailsLabel}</span>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {isOpen && (
                        <div className="border-t border-stone-100 dark:border-stone-800">
                          {log.stack && (
                            <pre className="px-4 py-3 text-[11px] text-stone-700 whitespace-pre-wrap break-words font-mono dark:text-stone-200">
                              {String(log.stack)}
                            </pre>
                          )}
                          {log.user_agent && (
                            <div className="px-4 pb-4 text-[11px] text-stone-500 break-words font-mono dark:text-stone-400">
                              {String(log.user_agent)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </AdminPanel>
              );
            })
          ) : (
            filtered.map((log: any) => {
              const isOpen = openId === log.id;
              const sev = String(log.level || 'info');
              const sevCls =
                sev === 'error'
                  ? 'bg-red-100 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40'
                  : sev === 'warn'
                    ? 'bg-amber-100 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40'
                    : sev === 'warning'
                      ? 'bg-amber-100 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40'
                      : 'bg-stone-100 text-stone-700 border-stone-100 dark:bg-stone-900/60 dark:text-stone-200 dark:border-stone-800';
              return (
                <AdminPanel key={log.id} className="p-6">
                  <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start">
                    <div className="flex gap-3 items-start">
                      <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${sevCls}`}>
                        <Server size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-stone-900 break-all dark:text-stone-100">{log.message}</h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {new Date(log.created_at).toLocaleString('cs-CZ')}
                          </span>
                          {log.category && (
                            <span className="px-2 py-1 rounded-full border bg-white text-stone-600 border-stone-200 dark:bg-stone-950 dark:text-stone-300 dark:border-stone-800">
                              {String(log.category)}
                            </span>
                          )}
                          {log.method && (
                            <span className="px-2 py-1 rounded-full border bg-white text-stone-600 border-stone-200 dark:bg-stone-950 dark:text-stone-300 dark:border-stone-800">
                              {String(log.method)}
                            </span>
                          )}
                          {log.url && <span className="max-w-[300px] truncate" title={String(log.url)}>{String(log.url)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(log.data || log.request_id || log.user_id || log.ip || log.user_agent) && (
                    <div className="mt-4 bg-white rounded-xl border border-stone-100 overflow-hidden dark:bg-stone-950 dark:border-stone-800">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : String(log.id))}
                        className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition dark:text-stone-300 dark:hover:bg-stone-900/60"
                      >
                        <span>{t.detailsLabel}</span>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {isOpen && (
                        <pre className="px-4 py-3 text-[11px] text-stone-700 whitespace-pre-wrap break-words font-mono border-t border-stone-100 dark:text-stone-200 dark:border-stone-800">
                          {JSON.stringify(
                            {
                              request_id: log.request_id,
                              user_id: log.user_id,
                              ip: log.ip,
                              user_agent: log.user_agent,
                              data: log.data,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      )}
                    </div>
                  )}
                </AdminPanel>
              );
            })
          )
        )}
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-6">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50 dark:bg-stone-950 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-900/60"
          >
            {isFetchingNextPage ? t.loadingMore : t.loadMore}
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={purgeModalOpen}
        onClose={() => setPurgeModalOpen(false)}
        title={t.purgeConfirmTitle}
        message={purgeMessage}
        confirmLabel={t.purgeConfirmDeleteLabel}
        cancelLabel={dict.common.cancel}
        variant="danger"
        onConfirm={async () => {
          try {
            setPurgePending(true);
            const res = await runPurge();
            showToast(fmt(t.purgeDeletedToast, { count: Number(res?.deletedCount || 0) }), 'success');
            queryClient.invalidateQueries({ queryKey: ['logs'] });
          } catch (e: any) {
            showToast(e?.message || t.errors.generic, 'error');
          } finally {
            setPurgePending(false);
          }
        }}
      />
      </AdminPanel>
    </div>
  );
}
