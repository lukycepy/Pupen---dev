'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Dialog from '@/app/components/ui/Dialog';
import InlinePulse from '@/app/components/InlinePulse';
import { supabase } from '@/lib/supabase';
import { FileText, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';

function fmtDate(value: any) {
  try {
    return new Date(String(value)).toLocaleString();
  } catch {
    return '';
  }
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

export default function GlobalAuditDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [action, setAction] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const queryUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (action) params.set('action', action);
    if (email) params.set('email', email);
    if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      params.set('dateTo', d.toISOString());
    }
    return `/api/admin/trustbox/audit?${params.toString()}`;
  }, [action, email, dateFrom, dateTo]);

  const auditQuery = useQuery({
    queryKey: ['trustbox_global_audit', queryUrl],
    enabled: open,
    queryFn: async () => authFetch(queryUrl),
    refetchInterval: 15_000,
  });

  if (!open) return null;

  const actionLabel = (a: any) => {
    const v = String(a || '').trim();
    if (lang === 'en') {
      if (v === 'ADMIN_VIEW_PII') return 'View PII';
      if (v === 'ADMIN_EXPORT_PDF') return 'Export PDF';
      if (v === 'ADMIN_DOWNLOAD_ATTACHMENT') return 'Download attachment';
      if (v === 'ADMIN_MESSAGE_SENT') return 'Message sent';
      if (v === 'ADMIN_THREAD_UPDATE') return 'Thread update';
      if (v === 'ADMIN_ASSIGN_OWNER') return 'Assign owner';
      if (v === 'ADMIN_UPDATE_SETTINGS') return 'Update settings';
      if (v === 'ADMIN_ADD_ADMIN') return 'Add admin';
      if (v === 'ADMIN_REMOVE_ADMIN') return 'Remove admin';
      if (v === 'ADMIN_UPDATE_ADMIN_PERMS') return 'Update permissions';
      return v || '—';
    }
    if (v === 'ADMIN_VIEW_PII') return 'Zobrazení PII';
    if (v === 'ADMIN_EXPORT_PDF') return 'Export PDF';
    if (v === 'ADMIN_DOWNLOAD_ATTACHMENT') return 'Stažení přílohy';
    if (v === 'ADMIN_MESSAGE_SENT') return 'Odeslání zprávy';
    if (v === 'ADMIN_THREAD_UPDATE') return 'Změna vlákna';
    if (v === 'ADMIN_ASSIGN_OWNER') return 'Přiřazení ownera';
    if (v === 'ADMIN_UPDATE_SETTINGS') return 'Změna nastavení';
    if (v === 'ADMIN_ADD_ADMIN') return 'Přidání admina';
    if (v === 'ADMIN_REMOVE_ADMIN') return 'Odebrání admina';
    if (v === 'ADMIN_UPDATE_ADMIN_PERMS') return 'Úprava oprávnění';
    return v || '—';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      overlayClassName="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-300 text-left"
      panelClassName="bg-white w-full max-w-5xl h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
    >
      <div className="p-6 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-white text-stone-900 shadow-sm border border-stone-100">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-stone-900">{lang === 'en' ? 'Global audit log' : 'Globální audit log'}</h2>
            <div className="text-sm font-bold text-stone-500">
              {lang === 'en' ? 'Records of PII access and changes' : 'Záznamy o přístupech a změnách'}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-3 rounded-2xl bg-white text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition shadow-sm border border-stone-100"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6 border-b border-stone-100 bg-white shrink-0 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 px-1">Akce</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none"
            >
              <option value="">{lang === 'en' ? 'All actions' : 'Všechny akce'}</option>
              <option value="ADMIN_VIEW_PII">{actionLabel('ADMIN_VIEW_PII')}</option>
              <option value="ADMIN_EXPORT_PDF">{actionLabel('ADMIN_EXPORT_PDF')}</option>
              <option value="ADMIN_DOWNLOAD_ATTACHMENT">{actionLabel('ADMIN_DOWNLOAD_ATTACHMENT')}</option>
              <option value="ADMIN_MESSAGE_SENT">{actionLabel('ADMIN_MESSAGE_SENT')}</option>
              <option value="ADMIN_THREAD_UPDATE">{actionLabel('ADMIN_THREAD_UPDATE')}</option>
              <option value="ADMIN_ASSIGN_OWNER">{actionLabel('ADMIN_ASSIGN_OWNER')}</option>
              <option value="ADMIN_UPDATE_SETTINGS">{actionLabel('ADMIN_UPDATE_SETTINGS')}</option>
              <option value="ADMIN_ADD_ADMIN">{actionLabel('ADMIN_ADD_ADMIN')}</option>
              <option value="ADMIN_REMOVE_ADMIN">{actionLabel('ADMIN_REMOVE_ADMIN')}</option>
              <option value="ADMIN_UPDATE_ADMIN_PERMS">{actionLabel('ADMIN_UPDATE_ADMIN_PERMS')}</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 px-1">E-mail admina</label>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
              <Search size={14} className="text-stone-400" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Hledat..."
                className="w-full bg-transparent font-bold text-stone-700 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 px-1">Od</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 px-1">Do</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-700 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
        {auditQuery.isLoading ? (
          <div className="py-12 flex justify-center">
            <InlinePulse className="bg-stone-400/70" size={16} />
          </div>
        ) : (
          <div className="space-y-3">
            {(auditQuery.data?.items || []).length === 0 ? (
              <div className="text-center py-12 text-stone-500 font-bold">
                {lang === 'en' ? 'No records match the filters.' : 'Zadaným filtrům neodpovídají žádné záznamy.'}
              </div>
            ) : (
              (auditQuery.data?.items || []).map((log: any) => (
                <div key={log.id} className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 bg-stone-100 text-stone-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-stone-200">
                        {actionLabel(log.action)}
                      </span>
                      {log.pii_accessed && (
                        <span className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-100">
                          PII
                        </span>
                      )}
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                        {fmtDate(log.created_at)}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-stone-900">
                      {log.actor_email || 'Systém'} <span className="text-stone-400 font-normal">({log.ip || 'Neznámá IP'})</span>
                    </div>
                    {log.reason && (
                      <div className="mt-2 text-sm text-stone-600 bg-stone-50 p-2 rounded-xl border border-stone-100">
                        <span className="font-bold text-stone-400">Důvod:</span> {log.reason}
                      </div>
                    )}
                    {(log.thread_id || log.attachment_id) && (
                      <div className="mt-2 flex gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                        {log.thread_id && <span>Vlákno: {log.thread_id.split('-')[0]}...</span>}
                        {log.attachment_id && <span>Příloha: {log.attachment_id.split('-')[0]}...</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
