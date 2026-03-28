'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, FileText, Loader2, User, Mail, Phone, GraduationCap, Quote, FileCheck } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import SignaturePad from '../../../components/SignaturePad';
import Image from 'next/image';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import { Download } from 'lucide-react';
import Dialog from '@/app/components/ui/Dialog';
import { formatDatePrague, formatDateTimePrague } from '@/lib/time/prague';

export default function ApplicationsTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [chairSignature, setChairSignature] = useState('');
  const [storedSignature, setStoredSignature] = useState<string>('');
  const [useStoredSignature, setUseStoredSignature] = useState(true);
  const [saveAsDefaultSignature, setSaveAsDefaultSignature] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [decisionMembershipType, setDecisionMembershipType] = useState<'regular' | 'external'>('regular');
  const [showExcluded, setShowExcluded] = useState(false);
  const [excludedReason, setExcludedReason] = useState('');

  const isEn = (dict?.lang || 'cs') === 'en';

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;
      const res = await supabase.from('profiles').select('admin_signature_data_url').eq('id', userId).single();
      if (!res.error) {
        const val = String((res.data as any)?.admin_signature_data_url || '');
        setStoredSignature(val);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedApp) return;
    const mt = selectedApp.membership_type === 'external' ? 'external' : 'regular';
    setDecisionMembershipType(mt);
    setRejectionReason(selectedApp.rejection_reason || '');
    setExcludedReason(selectedApp.excluded_reason || '');
    setChairSignature('');
    setUseStoredSignature(true);
  }, [selectedApp]);

  const effectiveSignature = useMemo(() => {
    if (useStoredSignature && storedSignature) return storedSignature;
    return chairSignature;
  }, [chairSignature, storedSignature, useStoredSignature]);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications', showExcluded],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/applications?includeExcluded=${showExcluded ? '1' : '0'}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return Array.isArray(json?.applications) ? json.applications : [];
    }
  });

  const visibleApplications = useMemo(() => {
    return applications;
  }, [applications]);

  const selectedPendingIds = useMemo(() => {
    return visibleApplications
      .filter((a: any) => a?.__source !== 'manual_scan' && !a?.excluded_at && a?.status === 'pending' && selectedIds[String(a.id)])
      .map((a: any) => String(a.id));
  }, [selectedIds, visibleApplications]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, signature, reason, decisionType }: any) => {
      const { data } = await supabase.auth.getSession();
      const decidedByEmail = data.session?.user?.email || null;
      const token = data.session?.access_token || null;
      const shouldPersistSignature =
        saveAsDefaultSignature && signature && (!storedSignature || (!useStoredSignature && signature !== storedSignature));
      if (shouldPersistSignature) {
        const userId = data.session?.user?.id;
        if (userId) {
          await supabase.from('profiles').update({ admin_signature_data_url: signature }).eq('id', userId);
          setStoredSignature(signature);
        }
      }
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id,
          status,
          chairwoman_signature: signature,
          rejection_reason: reason,
          decision_membership_type: decisionType,
          decided_at: new Date().toISOString(),
          decided_by_email: decidedByEmail,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');

      if (status === 'approved') {
        const prev = applications.find((a: any) => a.id === id);
        const wasApproved = prev?.status === 'approved';
        if (!wasApproved) {
          if (!token) throw new Error('Unauthorized');
          const res = await fetch('/api/admin/applications/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ applicationId: id, lang: isEn ? 'en' : 'cs' }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error || 'Chyba');
        }
      }

      try {
        const prev = applications.find((a: any) => a.id === id);
        const prevStatus = String(prev?.status || '');
        if (token && prevStatus !== String(status)) {
          await fetch('/api/admin/applications/status-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ applicationId: id, lang: isEn ? 'en' : 'cs' }),
          });
        }
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedApp(null);
      setChairSignature('');
      setRejectionReason('');
      showToast(dict.admin.alertStatusUpdated || 'Status aktualizován', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const excludeMutation = useMutation({
    mutationFn: async ({ id, exclude, reason }: any) => {
      const { data } = await supabase.auth.getSession();
      const byEmail = data.session?.user?.email || null;
      if (!byEmail) throw new Error('Unauthorized');
      const token = data.session?.access_token || null;
      if (!token) throw new Error('Unauthorized');
      const payload = exclude
        ? { excluded_at: new Date().toISOString(), excluded_by_email: byEmail, excluded_reason: String(reason || '').trim() || null }
        : { excluded_at: null, excluded_by_email: null, excluded_reason: null };
      const res = await fetch('/api/admin/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedIds({});
      showToast(isEn ? 'Updated.' : 'Hotovo.', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || null;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/applications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedApp(null);
      showToast(isEn ? 'Deleted.' : 'Smazáno.', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  if (isLoading) return <SkeletonTabContent />;

  const bulkApprove = async () => {
    try {
      if (!storedSignature) {
        showToast(isEn ? 'Missing stored signature.' : 'Chybí uložený podpis.', 'error');
        return;
      }
      for (const id of selectedPendingIds) {
        const app = applications.find((a: any) => String(a.id) === String(id));
        const decisionType = app?.membership_type === 'external' ? 'external' : 'regular';
        await updateStatusMutation.mutateAsync({ id, status: 'approved', signature: storedSignature, decisionType });
      }
      setSelectedIds({});
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  const bulkReject = async () => {
    if (!confirm('Opravdu odmítnout vybrané přihlášky?')) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || null;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/applications/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: selectedPendingIds })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedIds({});
      showToast(`Odmítnuto ${Number(json?.count || 0)} přihlášek`, 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const openManualScan = async (app: any) => {
    try {
      const bucket = String(app?.__scan?.bucket || '');
      const path = String(app?.__scan?.path || '');
      if (!bucket || !path) throw new Error(isEn ? 'Missing scan file.' : 'Chybí sken.');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || null;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket, path, expiresIn: 300 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      const url = String(json?.signedUrl || '');
      if (!url) throw new Error(isEn ? 'Missing URL.' : 'Chybí URL.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  const openApplicationPdf = async (applicationId: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || null;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/applications/export-pdf?id=${encodeURIComponent(applicationId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Chyba');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={dict.admin.tabApplications}
        description="Správa a schvalování členských přihlášek"
        actions={
          <div className="flex items-center gap-2">
            {selectedPendingIds.length ? (
              <>
                <button
                  type="button"
                  onClick={bulkReject}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-600 hover:bg-red-200 transition"
                >
                  {isEn ? 'Bulk reject' : 'Hromadně zamítnout'} ({selectedPendingIds.length})
                </button>
                <button
                  type="button"
                  onClick={bulkApprove}
                  disabled={updateStatusMutation.isPending}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isEn ? 'Bulk approve' : 'Hromadně schválit'} ({selectedPendingIds.length})
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setShowExcluded((v) => !v)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition ${
                showExcluded ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {isEn ? (showExcluded ? 'Hide excluded' : 'Show excluded') : (showExcluded ? 'Skrýt vyloučené' : 'Zobrazit vyloučené')}
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl border border-stone-100">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                {visibleApplications.filter((a: any) => a?.__source !== 'manual_scan' && !a?.excluded_at && a.status === 'pending').length} k vyřízení
              </span>
            </div>
          </div>
        }
      />

      {visibleApplications.length === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title={dict.admin.emptyApplications || 'Žádné přihlášky'}
          description="Až někdo odešle přihlášku do členství, zobrazí se tady."
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visibleApplications.map((app: any) => (
          <div 
            key={app.id} 
            onClick={() => setSelectedApp(app)}
            className={`group bg-white p-6 rounded-[2.5rem] border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 ${
              selectedApp?.id === app.id 
                ? 'border-green-500 ring-4 ring-green-50' 
                : 'border-stone-100 shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400 font-black text-xl border border-stone-100 group-hover:bg-white group-hover:scale-110 transition-all">
                {String(app.full_name || app.name || '').split(' ').filter(Boolean).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '—'}
              </div>
              <div className="flex items-center gap-2">
                {app.__source !== 'manual_scan' && !app.excluded_at && app.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelected(String(app.id));
                    }}
                    className="w-7 h-7 rounded-xl border border-stone-200 bg-white flex items-center justify-center"
                  >
                    <div className={`w-4 h-4 rounded-md ${selectedIds[String(app.id)] ? 'bg-green-600' : 'bg-stone-100'}`} />
                  </button>
                ) : null}
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                  app.excluded_at ? 'bg-stone-200 text-stone-700' :
                  app.status === 'approved' ? 'bg-green-100 text-green-700' : 
                  app.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                  app.status === 'manual' ? 'bg-stone-100 text-stone-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {app.excluded_at
                    ? (isEn ? 'Excluded' : 'Vyloučeno')
                    : app.status === 'approved'
                      ? 'Schváleno'
                      : app.status === 'rejected'
                        ? 'Odmítnuto'
                        : app.status === 'manual'
                          ? (isEn ? 'Manual' : 'Ruční')
                          : 'Čeká'}
                </span>
              </div>
            </div>
            <h3 className="font-black text-stone-900 text-lg mb-1 group-hover:text-green-600 transition-colors">{app.full_name || app.name}</h3>
            <div className="flex items-center gap-3 mb-6">
              <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest flex items-center gap-1"><Clock size={12} /> {new Date(app.created_at).toLocaleDateString()}</p>
              <span className="w-1 h-1 bg-stone-200 rounded-full"></span>
              <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest truncate max-w-[100px]">{String(app.email || '').split('@')[0] || '—'}</p>
            </div>
            {(app.membership_type || app.university_email || app.field_of_study || app.study_year) ? (
              <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-50 group-hover:bg-white transition-all">
                <p className="text-stone-500 text-xs font-medium line-clamp-2 leading-relaxed">
                  {(app.membership_type === 'external' ? 'Externí' : 'Řádné')}{app.field_of_study ? ` • ${app.field_of_study}` : ''}{app.study_year ? ` • ${app.study_year}` : ''}
                </p>
              </div>
            ) : app.motivation ? (
              <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-50 group-hover:bg-white transition-all">
                <p className="text-stone-500 text-xs font-medium line-clamp-2 italic leading-relaxed">"{app.motivation}"</p>
              </div>
            ) : null}
          </div>
          ))}
        </div>
      )}

      {selectedApp && (
        <Dialog
          open={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          overlayClassName="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300"
          panelClassName="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500"
        >
          <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/20">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-stone-900 tracking-tight">{dict.admin.appDetail || 'Detail přihlášky'}</h2>
                  <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mt-0.5">ID: {String(selectedApp.id || '').slice(0, 8)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedApp.__source === 'manual_scan' ? (
                  <button
                    type="button"
                    onClick={() => openManualScan(selectedApp)}
                    className="flex items-center gap-2 px-4 py-3 bg-white border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition text-[10px] font-black uppercase tracking-widest shadow-sm"
                  >
                    <Download size={14} /> {isEn ? 'Open scan' : 'Otevřít sken'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openApplicationPdf(String(selectedApp.id || ''))}
                    className="flex items-center gap-2 px-4 py-3 bg-white border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition text-[10px] font-black uppercase tracking-widest shadow-sm"
                  >
                    <Download size={14} /> Export PDF
                  </button>
                )}
                {selectedApp.__source !== 'manual_scan' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(isEn ? 'Really delete this application?' : 'Opravdu smazat tuto přihlášku?')) return;
                      deleteMutation.mutate({ id: String(selectedApp.id) });
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-[10px] font-black uppercase tracking-widest shadow-sm disabled:opacity-50"
                  >
                    {isEn ? 'Delete' : 'Smazat'}
                  </button>
                )}
                <button onClick={() => setSelectedApp(null)} className="p-3 hover:bg-stone-100 rounded-2xl transition text-stone-400 hover:text-stone-900">
                  <XCircle size={28} />
                </button>
              </div>
            </div>
            
            <div className="flex-grow min-h-0 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
              <div className="grid lg:grid-cols-12 gap-12">
                <div className="lg:col-span-7 space-y-10">
                  <section className="rounded-[2.5rem] border border-stone-100 bg-white shadow-sm p-8">
                    <div className="flex items-center gap-3 text-stone-900 mb-6">
                      <User size={20} className="text-green-600" />
                      <h3 className="text-sm font-black uppercase tracking-widest">{dict.admin.personalData || 'Osobní údaje'}</h3>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{dict.admin.labelFirstName || 'Jméno'}</p>
                        <p className="text-xl font-black text-stone-900">{selectedApp.first_name || String(selectedApp.full_name || selectedApp.name || '').split(' ')[0] || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{dict.admin.labelLastName || 'Příjmení'}</p>
                        <p className="text-xl font-black text-stone-900">{selectedApp.last_name || String(selectedApp.full_name || selectedApp.name || '').split(' ').slice(1).join(' ') || '—'}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Email</p>
                        <p className="text-sm font-bold text-stone-700 flex items-center gap-2 break-all">
                          <Mail size={14} className="text-stone-400" /> {selectedApp.email}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Telefon</p>
                        <p className="text-sm font-bold text-stone-700 flex items-center gap-2">
                          <Phone size={14} className="text-stone-400" /> {selectedApp.phone || '-'}
                        </p>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{isEn ? 'Address' : 'Adresa'}</p>
                        <p className="text-sm font-bold text-stone-700">{selectedApp.address || '-'}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{isEn ? 'GDPR consent' : 'GDPR souhlas'}</p>
                        <p className={`text-sm font-black ${selectedApp.gdpr_consent ? 'text-green-700' : 'text-red-700'}`}>
                          {selectedApp.gdpr_consent ? (isEn ? 'Yes' : 'Ano') : (isEn ? 'No' : 'Ne')}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{dict.recruitment?.membershipTypeLabel || 'Typ členství'}</p>
                        <p className="text-sm font-bold text-stone-700">{selectedApp.membership_type === 'external' ? 'Externí' : 'Řádné'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{dict.recruitment?.labelSubmittedAt || 'Datum podání'}</p>
                        <p className="text-sm font-bold text-stone-700">{selectedApp.created_at ? formatDatePrague(selectedApp.created_at, isEn ? 'en' : 'cs') : '-'}</p>
                      </div>
                    </div>

                    <div className="mt-10 border-t border-stone-100 pt-8">
                      <div className="flex items-center gap-3 text-stone-900 mb-6">
                        <GraduationCap size={20} className="text-blue-600" />
                        <h3 className="text-sm font-black uppercase tracking-widest">{dict.recruitment?.labelFieldOfStudy || 'Studium'}</h3>
                      </div>
                      {selectedApp.membership_type !== 'external' ? (
                        <div className="grid sm:grid-cols-2 gap-8">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                              {dict.recruitment?.labelUniversityEmail || 'Univerzitní email (v případě žádného členství)'}
                            </p>
                            <p className="font-black text-blue-700 text-sm break-all">{selectedApp.university_email || '—'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{dict.recruitment?.labelStudyYear || 'Ročník'}</p>
                            <p className="font-black text-stone-900 text-sm">{selectedApp.study_year || '—'}</p>
                          </div>
                          <div className="sm:col-span-2 space-y-1">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{dict.recruitment?.labelFieldOfStudy || 'Obor'}</p>
                            <p className="font-black text-blue-700 text-sm">{selectedApp.field_of_study || selectedApp.faculty || '—'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-blue-50/40 rounded-[1.75rem] border border-blue-100 p-6">
                          <p className="font-black text-blue-900 text-sm">{dict.recruitment?.membershipExternalDesc || 'Externí členství'}</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {selectedApp.motivation && (
                    <section className="rounded-[2.5rem] border border-stone-100 bg-white shadow-sm p-8 space-y-6">
                      <div className="flex items-center gap-3 text-stone-900">
                        <Quote size={20} className="text-amber-600" />
                        <h3 className="text-sm font-black uppercase tracking-widest">{dict.admin.motivation || (isEn ? 'Note' : 'Poznámka')}</h3>
                      </div>
                      <div className="bg-amber-50/30 p-8 rounded-[2rem] border border-amber-100 relative">
                        <Quote className="absolute top-4 left-4 text-amber-200" size={32} />
                        <p className="text-stone-700 leading-relaxed italic font-medium relative z-10 pl-4 text-lg">"{selectedApp.motivation}"</p>
                      </div>
                    </section>
                  )}

                  <section className="space-y-6">
                    <div className="flex items-center gap-3 text-stone-900">
                      <FileCheck size={20} className="text-stone-700" />
                      <h3 className="text-sm font-black uppercase tracking-widest">{dict.admin.applicantSignature || 'Podpis žadatele'}</h3>
                    </div>
                    <div className="rounded-[2.5rem] border border-stone-100 bg-white shadow-sm p-8 flex items-center justify-center">
                      {(() => {
                        const src = selectedApp.applicant_signature || selectedApp.signature_data_url;
                        return typeof src === 'string' && src ? (
                          <Image
                            src={src}
                            alt="Podpis"
                            width={640}
                            height={220}
                            className="max-w-full h-auto mix-blend-multiply"
                            unoptimized
                          />
                        ) : (
                          <div className="text-stone-400 font-bold text-sm">{dict.admin.missingSignature || (isEn ? 'Missing signature' : 'Chybí podpis')}</div>
                        );
                      })()}
                    </div>
                  </section>
                </div>

                <div className="lg:col-span-5 space-y-8">
                  <div className="relative bg-stone-900 text-white p-10 rounded-[3rem] shadow-xl sticky top-0 overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-green-600/90" />
                    {selectedApp.__source === 'manual_scan' ? (
                      <div className="text-center py-6 space-y-6">
                        <div>
                          <h3 className="text-2xl font-black mb-1">{isEn ? 'Manual application' : 'Ruční přihláška'}</h3>
                          <p className="text-stone-400 text-xs font-medium">{isEn ? 'This record comes from a manually uploaded scan.' : 'Tento záznam pochází z ručně nahraného skenu.'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openManualScan(selectedApp)}
                          className="w-full bg-white text-stone-900 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-stone-100 transition"
                        >
                          {isEn ? 'Open scan' : 'Otevřít sken'}
                        </button>
                      </div>
                    ) : selectedApp.status === 'pending' ? (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-2xl font-black mb-1">{dict.admin.decision || 'Rozhodnutí'}</h3>
                          <p className="text-stone-400 text-xs font-medium">Posouzení přihlášky a aktivace členství</p>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 px-1">{dict.admin.decisionMembershipType || 'Typ členství (rozhodnutí)'}</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setDecisionMembershipType('regular')}
                                    className={`rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border transition ${
                                decisionMembershipType === 'regular'
                                  ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-900/40'
                                        : 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700'
                              }`}
                            >
                              {dict.admin.decisionTypeRegular || 'Řádné'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDecisionMembershipType('external')}
                                    className={`rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border transition ${
                                decisionMembershipType === 'external'
                                  ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-900/40'
                                        : 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700'
                              }`}
                            >
                              {dict.admin.decisionTypeExternal || 'Externí'}
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 px-1">{dict.admin.rejectionReason || 'Důvod odmítnutí (volitelné)'}</label>
                          <textarea 
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className="w-full bg-stone-800 border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-red-500 transition placeholder:text-stone-600 text-white"
                            placeholder={dict.admin.rejectionPlaceholder || 'Proč byla přihláška zamítnuta?'}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 px-1">{isEn ? 'Exclusion (internal)' : 'Vyloučení (interní)'}</label>
                          <textarea
                            value={excludedReason}
                            onChange={(e) => setExcludedReason(e.target.value)}
                            className="w-full bg-stone-800 border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-stone-400 transition placeholder:text-stone-600 text-white"
                            placeholder={isEn ? 'Reason (optional)' : 'Důvod (volitelné)'}
                          />
                          {selectedApp.excluded_at ? (
                            <button
                              type="button"
                              disabled={excludeMutation.isPending}
                              onClick={() => excludeMutation.mutate({ id: selectedApp.id, exclude: false })}
                              className="w-full rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700 transition disabled:opacity-50"
                            >
                              {isEn ? 'Restore' : 'Zrušit vyloučení'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={excludeMutation.isPending}
                              onClick={() => excludeMutation.mutate({ id: selectedApp.id, exclude: true, reason: excludedReason })}
                              className="w-full rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700 transition disabled:opacity-50"
                            >
                              {isEn ? 'Exclude' : 'Vyloučit'}
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 px-1">{dict.admin.chairwomanSignature || 'Podpis předsedy'}</label>
                          {storedSignature ? (
                            <div className="space-y-3">
                              <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={useStoredSignature}
                                  onChange={(e) => setUseStoredSignature(e.target.checked)}
                                  className="w-4 h-4 accent-green-600"
                                />
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                                  {dict.admin.useStoredSignature || 'Použít uložený podpis'}
                                </span>
                              </label>
                              {useStoredSignature ? (
                                <div className="bg-white rounded-[2rem] p-6 border-4 border-stone-800 shadow-inner">
                                  <Image
                                    src={storedSignature}
                                    alt="Podpis"
                                    width={640}
                                    height={180}
                                    unoptimized
                                    className="w-full h-auto max-h-40 object-contain mix-blend-multiply"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUseStoredSignature(false);
                                      setChairSignature('');
                                    }}
                                    className="mt-4 w-full rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700 transition"
                                  >
                                    {dict.admin.editSignature || 'Změnit podpis'}
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="bg-white rounded-[2rem] overflow-hidden border-4 border-stone-800">
                                    <SignaturePad
                                      onSave={(dataUrl) => setChairSignature(dataUrl)}
                                      onClear={() => setChairSignature('')}
                                      clearLabel={dict.recruitment?.btnClear || 'Smazat'}
                                    />
                                  </div>
                                  <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={saveAsDefaultSignature}
                                      onChange={(e) => setSaveAsDefaultSignature(e.target.checked)}
                                      className="w-4 h-4 accent-green-600"
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                                      {dict.admin.saveSignatureForLater || 'Uložit podpis pro příště'}
                                    </span>
                                  </label>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="bg-white rounded-[2rem] overflow-hidden border-4 border-stone-800">
                                <SignaturePad
                                  onSave={(dataUrl) => setChairSignature(dataUrl)}
                                  onClear={() => setChairSignature('')}
                                  clearLabel={dict.recruitment?.btnClear || 'Smazat'}
                                />
                              </div>
                              <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={saveAsDefaultSignature}
                                  onChange={(e) => setSaveAsDefaultSignature(e.target.checked)}
                                  className="w-4 h-4 accent-green-600"
                                />
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                                  {dict.admin.saveSignatureForLater || 'Uložit podpis pro příště'}
                                </span>
                              </label>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4">
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: selectedApp.id, status: 'approved', signature: effectiveSignature, decisionType: decisionMembershipType })}
                            disabled={!effectiveSignature || updateStatusMutation.isPending || !!selectedApp.excluded_at}
                            className="bg-green-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-500 disabled:opacity-50 transition-all flex flex-col items-center justify-center gap-2 shadow-lg shadow-green-900/40"
                          >
                            <CheckCircle size={24} />
                            {dict.admin.btnApprove || 'Schválit'}
                          </button>
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: selectedApp.id, status: 'rejected', signature: effectiveSignature, reason: rejectionReason, decisionType: decisionMembershipType })}
                            disabled={!effectiveSignature || updateStatusMutation.isPending || !!selectedApp.excluded_at}
                            className="bg-red-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-500 disabled:opacity-50 transition-all flex flex-col items-center justify-center gap-2 shadow-lg shadow-red-900/40"
                          >
                            <XCircle size={24} />
                            {dict.admin.btnReject || 'Odmítnout'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 space-y-8">
                        <div className="relative inline-block">
                          <div className={`w-24 h-24 mx-auto rounded-3xl flex items-center justify-center shadow-2xl rotate-3 ${
                            selectedApp.status === 'approved' ? 'bg-green-600' : 'bg-red-600'
                          }`}>
                            {selectedApp.status === 'approved' ? <CheckCircle size={48} /> : <XCircle size={48} />}
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-white text-stone-900 rounded-full p-2 shadow-lg">
                            <FileCheck size={16} />
                          </div>
                        </div>

                        <div>
                          <h3 className="text-3xl font-black uppercase tracking-tighter mb-1">{dict.admin.decided || 'Rozhodnuto'}</h3>
                          <p className={`font-black uppercase tracking-[0.2em] text-xs ${
                            selectedApp.status === 'approved' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {selectedApp.status === 'approved' ? (dict.admin.appApproved || 'Přihláška schválena') : (dict.admin.appRejected || 'Přihláška zamítnuta')}
                          </p>
                        </div>

                        <div className="rounded-[2rem] border border-stone-800/70 bg-black/30 px-6 py-5 text-left">
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{isEn ? 'Decided at' : 'Rozhodnuto dne'}</span>
                              <span className="text-xs font-black text-white/90">
                                {selectedApp.decided_at ? formatDateTimePrague(selectedApp.decided_at, isEn ? 'en' : 'cs') : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{isEn ? 'Decided by' : 'Rozhodl'}</span>
                              <span className="text-xs font-black text-white/90 break-all text-right">{selectedApp.decided_by_email || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{isEn ? 'Membership' : 'Typ členství'}</span>
                              <span className="text-xs font-black text-white/90">
                                {selectedApp.decision_membership_type
                                  ? selectedApp.decision_membership_type === 'external'
                                    ? isEn
                                      ? 'External'
                                      : 'Externí'
                                    : isEn
                                      ? 'Regular'
                                      : 'Řádné'
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {selectedApp.rejection_reason && (
                          <div className="p-6 bg-red-900/30 text-red-200 rounded-[2rem] text-sm italic font-medium border border-red-800/50">
                            "{selectedApp.rejection_reason}"
                          </div>
                        )}

                        <div className="p-6 bg-black/30 rounded-[2rem] border border-stone-800/70">
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-500">{isEn ? 'Exclusion (internal)' : 'Vyloučení (interní)'}</div>
                          {selectedApp.excluded_at ? (
                            <div className="mt-3 text-xs font-black text-white/90">
                              {isEn ? 'Excluded' : 'Vyloučeno'} • {new Date(selectedApp.excluded_at).toLocaleString(isEn ? 'en-GB' : 'cs-CZ')}
                            </div>
                          ) : (
                            <div className="mt-3 text-xs font-black text-white/70">{isEn ? 'Not excluded' : 'Nevyloučeno'}</div>
                          )}
                          <div className="mt-4 space-y-3">
                            <textarea
                              value={excludedReason}
                              onChange={(e) => setExcludedReason(e.target.value)}
                              className="w-full bg-stone-800 border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-stone-400 transition placeholder:text-stone-600 text-white"
                              placeholder={isEn ? 'Reason (optional)' : 'Důvod (volitelné)'}
                            />
                            {selectedApp.excluded_at ? (
                              <button
                                type="button"
                                disabled={excludeMutation.isPending}
                                onClick={() => excludeMutation.mutate({ id: selectedApp.id, exclude: false })}
                                className="w-full rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700 transition disabled:opacity-50"
                              >
                                {isEn ? 'Restore' : 'Zrušit vyloučení'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={excludeMutation.isPending}
                                onClick={() => excludeMutation.mutate({ id: selectedApp.id, exclude: true, reason: excludedReason })}
                                className="w-full rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700 transition disabled:opacity-50"
                              >
                                {isEn ? 'Exclude' : 'Vyloučit'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="pt-8 border-t border-stone-800">
                          <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 block mb-4">{dict.admin.chairwomanSignature || 'Podpis předsedy'}</span>
                          <div className="bg-white rounded-[2rem] p-6 shadow-inner">
                            {typeof selectedApp.chairwoman_signature === 'string' && selectedApp.chairwoman_signature ? (
                              <Image 
                                src={selectedApp.chairwoman_signature} 
                                alt={isEn ? 'Chair signature' : 'Podpis předsedy'} 
                                width={400} 
                                height={150} 
                                className="w-full h-auto mix-blend-multiply" 
                                unoptimized
                              />
                            ) : (
                              <div className="text-stone-500 font-bold text-sm">{dict.admin.missingSignature || (isEn ? 'Missing signature' : 'Chybí podpis')}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
        </Dialog>
      )}
    </div>
  );
}
