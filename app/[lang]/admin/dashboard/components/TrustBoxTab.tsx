'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, Search, Clock, ShieldCheck, Paperclip, Settings2, UserPlus, Trash2, FileText } from 'lucide-react';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import AdminPanel from './ui/AdminPanel';
import { SkeletonTabContent } from '../../../components/Skeleton';
import Dialog from '@/app/components/ui/Dialog';
import InlinePulse from '@/app/components/InlinePulse';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import GlobalAuditDialog from './GlobalAuditDialog';

function fmtDate(value: any) {
  try {
    return new Date(String(value)).toLocaleString();
  } catch {
    return '';
  }
}

function chipClass(kind: string) {
  if (kind === 'urgent') return 'bg-red-50 text-red-700 border-red-100';
  if (kind === 'resolved') return 'bg-green-50 text-green-700 border-green-100';
  if (kind === 'archived') return 'bg-stone-100 text-stone-600 border-stone-200';
  if (kind === 'in_review') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (kind === 'waiting_for_info') return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-stone-50 text-stone-700 border-stone-200';
}

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

export default function TrustBoxTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const qc = useQueryClient();

  const [q, setQ] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [replyText, setReplyText] = React.useState('');
  const [replyInternal, setReplyInternal] = React.useState(false);
  const [replyNotify, setReplyNotify] = React.useState(true);
  const [piiReason, setPiiReason] = React.useState('');
  const [pii, setPii] = React.useState<any>(null);

  const [globalAuditOpen, setGlobalAuditOpen] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trustbox_threads'],
    queryFn: async () => authFetch('/api/admin/trustbox/threads'),
    refetchInterval: 15_000,
  });

  const items = React.useMemo<any[]>(() => {
    const raw = (data as any)?.items;
    return Array.isArray(raw) ? raw : [];
  }, [data]);
  const canViewPii = !!data?.canViewPii;
  const isSuperadmin = !!data?.isSuperadmin;

  const settingsQuery = useQuery({
    queryKey: ['trustbox_settings'],
    enabled: isSuperadmin,
    queryFn: async () => authFetch('/api/admin/trustbox/settings'),
  });

  const adminsQuery = useQuery({
    queryKey: ['trustbox_admins'],
    enabled: isSuperadmin,
    queryFn: async () => authFetch('/api/admin/trustbox/admins'),
  });

  const [retentionDays, setRetentionDays] = React.useState<number>(365);
  const [autoAnonymize, setAutoAnonymize] = React.useState(true);
  const [staffSubdomains, setStaffSubdomains] = React.useState('');
  const [adminSearch, setAdminSearch] = React.useState('');
  const [adminCanViewPii, setAdminCanViewPii] = React.useState(false);

  React.useEffect(() => {
    if (!settingsQuery.data?.settings) return;
    const s = settingsQuery.data.settings;
    setRetentionDays(Number(s.retention_days || 365));
    setAutoAnonymize(s.auto_anonymize !== false);
    const list = Array.isArray(s.allowed_staff_subdomains) ? s.allowed_staff_subdomains : [];
    setStaffSubdomains(list.join(', '));
  }, [settingsQuery.data?.settings]);

  const userSearchQuery = useQuery({
    queryKey: ['trustbox_user_search', adminSearch],
    enabled: isSuperadmin && adminSearch.trim().length >= 2,
    queryFn: async () => authFetch(`/api/admin/users/search?query=${encodeURIComponent(adminSearch.trim())}&limit=10`),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () =>
      authFetch('/api/admin/trustbox/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retention_days: retentionDays,
          auto_anonymize: autoAnonymize,
          allowed_staff_subdomains: staffSubdomains,
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trustbox_settings'] });
      showToast('Uloženo', 'success');
    },
    onError: (e: any) => showToast(e.message, 'error'),
  });

  const addAdminMutation = useMutation({
    mutationFn: async (userId: string) =>
      authFetch('/api/admin/trustbox/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, canViewPii: adminCanViewPii }),
      }),
    onSuccess: async () => {
      setAdminSearch('');
      await qc.invalidateQueries({ queryKey: ['trustbox_admins'] });
      showToast('Přidáno', 'success');
    },
    onError: (e: any) => showToast(e.message, 'error'),
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ userId, canViewPii }: { userId: string; canViewPii: boolean }) =>
      authFetch(`/api/admin/trustbox/admins/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canViewPii }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trustbox_admins'] });
      showToast('Uloženo', 'success');
    },
    onError: (e: any) => showToast(e.message, 'error'),
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) =>
      authFetch(`/api/admin/trustbox/admins/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trustbox_admins'] });
      showToast('Odebráno', 'success');
    },
    onError: (e: any) => showToast(e.message, 'error'),
  });

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((t) => {
      const r = t?.reporter || {};
      return (
        String(t?.subject || '').toLowerCase().includes(s) ||
        String(t?.category || '').toLowerCase().includes(s) ||
        String(t?.status || '').toLowerCase().includes(s) ||
        String(r?.name || '').toLowerCase().includes(s) ||
        String(r?.email || '').toLowerCase().includes(s)
      );
    });
  }, [items, q]);

  const threadDetail = useQuery({
    queryKey: ['trustbox_thread', selectedId],
    enabled: !!selectedId && detailOpen,
    queryFn: async () => authFetch(`/api/admin/trustbox/threads/${encodeURIComponent(String(selectedId))}`),
  });
  React.useEffect(() => {
    if (!detailOpen) return;
    setPii(null);
    setPiiReason('');
  }, [detailOpen, selectedId]);

  const patchMutation = useMutation({
    mutationFn: async (patch: any) =>
      authFetch(`/api/admin/trustbox/threads/${encodeURIComponent(String(selectedId))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['trustbox_threads'] }),
        qc.invalidateQueries({ queryKey: ['trustbox_thread', selectedId] }),
      ]);
      showToast('Uloženo', 'success');
    },
    onError: (e: any) => showToast(e.message, 'error'),
  });

  const auditQuery = useQuery({
    queryKey: ['trustbox_audit', selectedId],
    enabled: !!selectedId && detailOpen,
    queryFn: async () => authFetch(`/api/admin/trustbox/audit?threadId=${encodeURIComponent(String(selectedId))}&limit=200`),
    refetchInterval: 15_000,
  });

  const signedUrlMutation = useMutation({
    mutationFn: async (attachmentId: string) =>
      authFetch('/api/admin/trustbox/attachments/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachmentId }),
      }),
    onSuccess: (d: any) => {
      const url = String(d?.url || '');
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    },
    onError: (e: any) => showToast(e.message, 'error'),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: any) =>
      authFetch(`/api/admin/trustbox/threads/${encodeURIComponent(String(selectedId))}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setReplyText('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['trustbox_threads'] }),
        qc.invalidateQueries({ queryKey: ['trustbox_thread', selectedId] }),
      ]);
      showToast('Odesláno', 'success');
    },
    onError: (e: any) => showToast(e.message, 'error'),
  });

  const viewPiiMutation = useMutation({
    mutationFn: async () =>
      authFetch(`/api/admin/trustbox/threads/${encodeURIComponent(String(selectedId))}/identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: piiReason }),
      }),
    onSuccess: (d: any) => {
      setPii(d?.identity || null);
      showToast('Identita zobrazena', 'success');
    },
    onError: (e: any) => showToast(e.message, 'error'),
  });

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={dict?.admin?.tabTrustBox || 'Schránka důvěry'}
        description={canViewPii ? 'Plný přístup (PII povoleno)' : 'Redacted režim (PII skryto)'}
        actions={
          <div className="flex items-center gap-2">
            {isSuperadmin && (
              <button
                onClick={() => setGlobalAuditOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition"
              >
                <FileText size={16} /> Globální Audit
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition"
            >
              <ShieldCheck size={16} /> Obnovit
            </button>
          </div>
        }
      />

      <AdminPanel className="p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 px-4 py-3 rounded-2xl w-full md:max-w-md">
            <Search size={16} className="text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat (předmět, kategorie, status, e-mail)…"
              className="bg-transparent outline-none w-full font-bold text-stone-700"
            />
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
            {filtered.length} / {items.length}
          </div>
        </div>
      </AdminPanel>

      {isSuperadmin && (
        <div className="grid lg:grid-cols-2 gap-6">
          <AdminPanel className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-stone-100 text-stone-700">
                <Settings2 size={18} />
              </div>
              <div>
                <div className="font-black text-stone-900">Nastavení</div>
                <div className="text-sm font-bold text-stone-500">Retence, anonymizace a subdomény ČZU</div>
              </div>
            </div>

            {settingsQuery.isLoading ? (
              <div className="py-6 flex justify-center">
                <InlinePulse className="bg-stone-400/70" size={14} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Retence (dny)</label>
                    <input
                      type="number"
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-3 font-bold text-stone-700">
                      <input type="checkbox" checked={autoAnonymize} onChange={(e) => setAutoAnonymize(e.target.checked)} />
                      Auto-anonymizace po retenci
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Povolené subdomény (staff)</label>
                  <textarea
                    value={staffSubdomains}
                    onChange={(e) => setStaffSubdomains(e.target.value)}
                    rows={3}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none resize-none"
                    placeholder="af, pef, ftz, rektorat, …"
                  />
                </div>

                <button
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={saveSettingsMutation.isPending}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-stone-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition disabled:opacity-50"
                >
                  {saveSettingsMutation.isPending ? <InlinePulse className="bg-white/80" size={12} /> : <ShieldCheck size={16} />}
                  Uložit
                </button>
              </div>
            )}
          </AdminPanel>

          <AdminPanel className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-stone-100 text-stone-700">
                <UserPlus size={18} />
              </div>
              <div>
                <div className="font-black text-stone-900">Správa přístupů</div>
                <div className="text-sm font-bold text-stone-500">Trustbox admini + PII oprávnění</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <input
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Najít uživatele…"
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none"
                />
                <label className="flex items-center gap-2 font-bold text-stone-700">
                  <input type="checkbox" checked={adminCanViewPii} onChange={(e) => setAdminCanViewPii(e.target.checked)} />
                  PII
                </label>
              </div>

              {adminSearch.trim().length >= 2 && (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 space-y-2">
                  {userSearchQuery.isLoading ? (
                    <div className="py-4 flex justify-center">
                      <InlinePulse className="bg-stone-400/70" size={12} />
                    </div>
                  ) : (
                    (userSearchQuery.data?.users || []).map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-stone-100 px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-bold text-stone-900 truncate">
                            {String(u.first_name || '')} {String(u.last_name || '')}
                          </div>
                          <div className="text-sm font-bold text-stone-500 truncate">{String(u.email || '')}</div>
                        </div>
                        <button
                          onClick={() => addAdminMutation.mutate(String(u.id))}
                          disabled={addAdminMutation.isPending}
                          className="px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition disabled:opacity-50"
                        >
                          Přidat
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="space-y-2">
                {(adminsQuery.data?.items || []).length === 0 ? (
                  <div className="text-sm font-bold text-stone-500">Žádní trustbox admini</div>
                ) : (
                  (adminsQuery.data?.items || []).map((a: any) => {
                    const p = a?.profiles || {};
                    return (
                      <div key={a.user_id} className="flex items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-bold text-stone-900 truncate">
                            {String(p.first_name || '')} {String(p.last_name || '')}
                          </div>
                          <div className="text-sm font-bold text-stone-500 truncate">{String(p.email || '')}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 font-bold text-stone-700">
                            <input
                              type="checkbox"
                              checked={a.can_view_pii === true}
                              onChange={(e) => updateAdminMutation.mutate({ userId: String(a.user_id), canViewPii: e.target.checked })}
                            />
                            PII
                          </label>
                          <button
                            onClick={() => removeAdminMutation.mutate(String(a.user_id))}
                            disabled={removeAdminMutation.isPending}
                            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 transition disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </AdminPanel>
        </div>
      )}

      {filtered.length === 0 ? (
        <AdminEmptyState icon={Inbox} title="Žádné podněty" description="Zatím tu nejsou žádná vlákna." />
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedId(String(t.id));
                setDetailOpen(true);
              }}
              className="w-full text-left"
            >
              <AdminPanel className="p-6 hover:bg-stone-50 transition">
                <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 truncate">{t.subject}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                      <span className={`px-2 py-1 rounded-lg border ${chipClass(String(t.status))}`}>{String(t.status)}</span>
                      <span className={`px-2 py-1 rounded-lg border ${chipClass(String(t.priority))}`}>{String(t.priority)}</span>
                      <span className="px-2 py-1 rounded-lg border border-stone-200 bg-stone-50 text-stone-700">{String(t.category)}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {fmtDate(t.last_activity_at || t.created_at)}</span>
                    </div>
                    <div className="mt-2 text-sm font-bold text-stone-600">
                      {t?.reporter?.name} · {t?.reporter?.email}
                    </div>
                  </div>
                </div>
              </AdminPanel>
            </button>
          ))}
        </div>
      )}

      {detailOpen && (
        <Dialog
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          overlayClassName="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-300 text-left"
          panelClassName="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden"
        >
          {threadDetail.isLoading ? (
            <div className="p-8 flex justify-center">
              <InlinePulse className="bg-stone-400/70" size={14} />
            </div>
          ) : (
            <div className="p-8 space-y-6">
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xl font-black text-stone-900">{threadDetail.data?.thread?.subject}</div>
                    <div className="text-sm font-bold text-stone-500">
                      {pii?.email
                        ? `${String(pii.first_name || '')} ${String(pii.last_name || '')}`.trim()
                        : threadDetail.data?.thread?.reporter?.name}{' '}
                      · {pii?.email ? String(pii.email) : threadDetail.data?.thread?.reporter?.email}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                      {fmtDate(threadDetail.data?.thread?.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const { data } = await supabase.auth.getSession();
                        const token = data.session?.access_token;
                        if (!token) throw new Error('Unauthorized');
                        const res = await fetch(`/api/admin/trustbox/threads/${encodeURIComponent(String(selectedId))}/export-pdf`, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!res.ok) throw new Error('Export failed');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank', 'noopener,noreferrer');
                        setTimeout(() => URL.revokeObjectURL(url), 60_000);
                      } catch (e: any) {
                        showToast(e?.message || 'Error', 'error');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition"
                  >
                    <FileText size={16} /> PDF
                  </button>
                </div>
              </div>

              {threadDetail.data?.piiAvailable && !pii?.email && (
                <AdminPanel className="p-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-3">Zobrazit identitu (PII)</div>
                  <div className="grid md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Důvod</label>
                      <input
                        value={piiReason}
                        onChange={(e) => setPiiReason(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none"
                        placeholder="Min. 10 znaků…"
                      />
                    </div>
                    <button
                      onClick={() => viewPiiMutation.mutate()}
                      disabled={viewPiiMutation.isPending || piiReason.trim().length < 10}
                      className="flex items-center justify-center gap-2 px-5 py-3 bg-stone-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition disabled:opacity-50"
                    >
                      {viewPiiMutation.isPending ? <InlinePulse className="bg-white/80" size={12} /> : <ShieldCheck size={16} />}
                      Zobrazit
                    </button>
                  </div>
                </AdminPanel>
              )}

              <AdminPanel className="p-5">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Status</label>
                    <select
                      value={String(threadDetail.data?.thread?.status || 'new')}
                      onChange={(e) => patchMutation.mutate({ status: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none"
                    >
                      <option value="new">new</option>
                      <option value="in_review">in_review</option>
                      <option value="waiting_for_info">waiting_for_info</option>
                      <option value="resolved">resolved</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Priorita</label>
                    <select
                      value={String(threadDetail.data?.thread?.priority || 'normal')}
                      onChange={(e) => patchMutation.mutate({ priority: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none"
                    >
                      <option value="normal">normal</option>
                      <option value="urgent">urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</label>
                    <input
                      defaultValue={String(threadDetail.data?.thread?.category || '')}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) patchMutation.mutate({ category: v });
                      }}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none"
                    />
                  </div>
                </div>
              </AdminPanel>

              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Zprávy</div>
                {(threadDetail.data?.messages || []).map((m: any) => (
                  <AdminPanel key={m.id} className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                        {String(m.author_type || '').toLowerCase() === 'reporter'
                          ? 'reporter'
                          : `${String(m.author_type || '')}${m.author_name ? ` (${String(m.author_name)})` : ''}`}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{fmtDate(m.created_at)}</div>
                    </div>
                    <div className="mt-3 font-bold text-stone-800 whitespace-pre-wrap">{m.body}</div>
                  </AdminPanel>
                ))}
              </div>

              <AdminPanel className="p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-3">Odpověď</div>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition resize-none"
                  placeholder="Napište odpověď…"
                />
                <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                  <div className="flex flex-col gap-2 text-sm font-bold text-stone-700">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={replyInternal}
                        onChange={(e) => setReplyInternal(e.target.checked)}
                      />
                      Interní poznámka (neposílat uživateli)
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={replyNotify}
                        onChange={(e) => setReplyNotify(e.target.checked)}
                        disabled={replyInternal || threadDetail.data?.thread?.allow_followup !== true || !!threadDetail.data?.thread?.anonymized_at}
                      />
                      Poslat e‑mail s odkazem na vlákno
                    </label>
                  </div>
                  <button
                    onClick={() =>
                      sendMessageMutation.mutate({
                        kind: replyInternal ? 'internal' : 'admin',
                        message: replyText,
                        notify: !replyInternal && replyNotify,
                      })
                    }
                    disabled={sendMessageMutation.isPending || !replyText.trim()}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {sendMessageMutation.isPending ? <InlinePulse className="bg-white/80" size={12} /> : <ShieldCheck size={16} />}
                    Odeslat
                  </button>
                </div>
              </AdminPanel>

              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Přílohy</div>
                {(threadDetail.data?.attachments || []).length === 0 ? (
                  <AdminPanel className="p-5">
                    <div className="text-sm font-bold text-stone-500">Žádné přílohy</div>
                  </AdminPanel>
                ) : (
                  <div className="space-y-2">
                    {(threadDetail.data?.attachments || []).map((a: any) => (
                      <AdminPanel key={a.id} className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-bold text-stone-900 truncate">{a.original_name}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                              {String(a.content_type)} · {Number(a.size_bytes || 0).toLocaleString()} B
                            </div>
                          </div>
                          <button
                            onClick={() => signedUrlMutation.mutate(String(a.id))}
                            disabled={signedUrlMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition disabled:opacity-50"
                          >
                            {signedUrlMutation.isPending ? <InlinePulse className="bg-stone-400/70" size={12} /> : <Paperclip size={16} />}
                            Stáhnout
                          </button>
                        </div>
                      </AdminPanel>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Audit</div>
                {auditQuery.isLoading ? (
                  <AdminPanel className="p-5">
                    <div className="flex justify-center">
                      <InlinePulse className="bg-stone-400/70" size={12} />
                    </div>
                  </AdminPanel>
                ) : (
                  <div className="space-y-2">
                    {(auditQuery.data?.items || []).length === 0 ? (
                      <AdminPanel className="p-5">
                        <div className="text-sm font-bold text-stone-500">Žádné audit záznamy</div>
                      </AdminPanel>
                    ) : (
                      (auditQuery.data?.items || []).map((l: any) => (
                        <AdminPanel key={l.id} className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{String(l.action)}</div>
                              <div className="text-sm font-bold text-stone-700 truncate">{String(l.actor_email || l.actor_user_id || '—')}</div>
                              {l.reason ? <div className="text-sm font-bold text-stone-500 whitespace-pre-wrap">{String(l.reason)}</div> : null}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{fmtDate(l.created_at)}</div>
                          </div>
                        </AdminPanel>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Dialog>
      )}

      {isSuperadmin && (
        <GlobalAuditDialog
          open={globalAuditOpen}
          onClose={() => setGlobalAuditOpen(false)}
        />
      )}
    </div>
  );
}
