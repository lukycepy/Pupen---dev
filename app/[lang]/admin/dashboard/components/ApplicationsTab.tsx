'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, FileText, FileCheck, Pencil, Save, Search, Upload, XCircle } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import Image from 'next/image';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import Drawer from '@/app/components/ui/Drawer';
import InlinePulse from '@/app/components/InlinePulse';
import SignaturePad from '../../../components/SignaturePad';
import { formatDatePrague, formatDateTimePrague } from '@/lib/time/prague';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { membershipApplicationAdminUpdateSchema } from '@/lib/validations/membership-applications-admin';

type MembershipApplicationRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  name: string | null;
  email: string | null;
  phone: string | null;
  decisionReason: string | null;
  meta: any;
};

type DetailResponse = {
  application: any;
  files: any[];
};

const PAGE_SIZE = 50;

function statusBadge(status: string) {
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function safeJsonParse(s: string) {
  const raw = String(s || '').trim();
  if (!raw) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid JSON' };
  }
}

export default function ApplicationsTab({ dict, readOnly }: { dict: any; readOnly?: boolean }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const isEn = (dict?.lang || 'cs') === 'en';

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [chairAuthKind, setChairAuthKind] = useState<'signature' | 'stamp'>('signature');
  const [chairAuthFileId, setChairAuthFileId] = useState<string>('');
  const [chairSignatureDataUrl, setChairSignatureDataUrl] = useState('');
  const [stampFile, setStampFile] = useState<File | null>(null);

  const [decisionStatus, setDecisionStatus] = useState<'approved' | 'rejected'>('approved');
  const [decisionMembershipType, setDecisionMembershipType] = useState<'regular' | 'external'>('regular');
  const [decisionReason, setDecisionReason] = useState('');

  const listQuery = useQuery({
    queryKey: ['membership_applications_v2', q, status, page],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      if (q.trim()) params.set('q', q.trim());
      if (status !== 'all') params.set('status', status);

      const res = await fetch(`/api/admin/membership-applications?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return { rows: (json?.rows || []) as MembershipApplicationRow[], count: json?.count as number | null };
    },
  });

  const detailQuery = useQuery({
    queryKey: ['membership_application_v2_detail', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/membership-applications/${selectedId}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json as DetailResponse;
    },
  });

  const selectedApplication = detailQuery.data?.application || null;
  const selectedMeta = selectedApplication?.meta && typeof selectedApplication.meta === 'object' ? selectedApplication.meta : {};
  const selectedDecision = selectedMeta?.decision && typeof selectedMeta.decision === 'object' ? selectedMeta.decision : {};

  const isPending = String(selectedApplication?.status || '') === 'pending';
  const isEditable = isPending && !readOnly;

  const applicantSignatureQuery = useQuery({
    queryKey: ['membership_application_v2_applicant_signature', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/membership-applications/${selectedId}/signature/signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expiresIn: 600 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return String(json?.signedUrl || '');
    },
  });

  const chairAuthSignedUrlQuery = useQuery({
    queryKey: ['membership_application_v2_chair_auth', selectedId, selectedDecision?.chair_auth_kind, selectedDecision?.chair_auth_file_id],
    enabled: !!selectedId && !!selectedDecision?.chair_auth_kind,
    queryFn: async () => {
      const kind = String(selectedDecision?.chair_auth_kind || '').trim();
      if (kind !== 'signature' && kind !== 'stamp') return '';
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/membership-applications/${selectedId}/chair-auth/signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind, expiresIn: 600 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return String(json?.signedUrl || '');
    },
  });

  const form = useForm<any>({
    resolver: zodResolver(membershipApplicationAdminUpdateSchema as any),
    defaultValues: {
      application: {
        email: '',
        phone: '',
        address: '',
        motivation: '',
        meta: {
          lang: 'cs',
          membership_type: 'regular',
          first_name: '',
          last_name: '',
          university_email: '',
          field_of_study: '',
          study_year: '',
          signed_on: '',
          gdpr_consent: false,
          address_meta_json: '',
          pdf_snapshot_cs_json: '',
          pdf_snapshot_en_json: '',
        },
      },
    },
    mode: 'onSubmit',
  });

  const { register, handleSubmit, reset, watch } = form;

  useEffect(() => {
    if (!selectedApplication) return;
    const m = selectedMeta;
    const snap = m?.pdf_snapshot && typeof m.pdf_snapshot === 'object' ? m.pdf_snapshot : {};

    reset({
      application: {
        email: selectedApplication?.email || '',
        phone: selectedApplication?.phone || '',
        address: selectedApplication?.address || '',
        motivation: selectedApplication?.motivation || '',
        meta: {
          lang: m?.lang === 'en' ? 'en' : 'cs',
          membership_type: m?.membership_type === 'external' ? 'external' : 'regular',
          first_name: m?.first_name || '',
          last_name: m?.last_name || '',
          university_email: m?.university_email || '',
          field_of_study: m?.field_of_study || '',
          study_year: m?.study_year || '',
          signed_on: m?.signed_on || '',
          gdpr_consent: !!m?.gdpr_consent,
          address_meta_json: m?.address_meta ? JSON.stringify(m.address_meta, null, 2) : '',
          pdf_snapshot_cs_json: snap?.cs ? JSON.stringify(snap.cs, null, 2) : '',
          pdf_snapshot_en_json: snap?.en ? JSON.stringify(snap.en, null, 2) : '',
        },
      },
    });

    setChairAuthKind('signature');
    setChairAuthFileId('');
    setChairSignatureDataUrl('');
    setStampFile(null);
    setDecisionStatus('approved');
    setDecisionReason(String(selectedApplication?.decision_reason || ''));
    const mt = String(selectedDecision?.membership_type || m?.membership_type || '');
    setDecisionMembershipType(mt === 'external' ? 'external' : 'regular');
  }, [reset, selectedApplication, selectedDecision, selectedMeta]);

  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const meta = values?.application?.meta || {};
      const addressMeta = safeJsonParse(meta.address_meta_json || '');
      if (!addressMeta.ok) throw new Error(addressMeta.error || 'Invalid JSON');

      const snapCs = safeJsonParse(meta.pdf_snapshot_cs_json || '');
      if (!snapCs.ok) throw new Error(snapCs.error || 'Invalid JSON');
      const snapEn = safeJsonParse(meta.pdf_snapshot_en_json || '');
      if (!snapEn.ok) throw new Error(snapEn.error || 'Invalid JSON');

      const patch: any = {
        application: {
          email: values?.application?.email,
          phone: values?.application?.phone,
          address: values?.application?.address || null,
          motivation: values?.application?.motivation || null,
          meta: {
            lang: meta.lang === 'en' ? 'en' : 'cs',
            membership_type: meta.membership_type === 'external' ? 'external' : 'regular',
            first_name: meta.first_name,
            last_name: meta.last_name,
            university_email: meta.membership_type === 'regular' ? (meta.university_email || null) : null,
            field_of_study: meta.membership_type === 'regular' ? (meta.field_of_study || null) : null,
            study_year: meta.membership_type === 'regular' ? (meta.study_year || null) : null,
            signed_on: meta.signed_on || null,
            gdpr_consent: !!meta.gdpr_consent,
            address_meta: addressMeta.value || {},
            pdf_snapshot: {
              cs: snapCs.value,
              en: snapEn.value,
            },
          },
        },
      };

      const res = await fetch(`/api/admin/membership-applications/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['membership_applications_v2'] }),
        qc.invalidateQueries({ queryKey: ['membership_application_v2_detail', selectedId] }),
      ]);
      showToast(dict?.admin?.alertUpdated || (isEn ? 'Saved.' : 'Uloženo.'), 'success');
    },
    onError: (e: any) => showToast(e?.message || (isEn ? 'Error' : 'Chyba'), 'error'),
  });

  const chairAuthUploadMutation = useMutation({
    mutationFn: async (payload: { kind: 'signature' | 'stamp'; dataUrl?: string; file?: File }) => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const form = new FormData();
      form.set('kind', payload.kind);
      if (payload.kind === 'signature') {
        form.set('dataUrl', String(payload.dataUrl || '').trim());
      } else {
        if (!payload.file) throw new Error('Missing file');
        form.set('file', payload.file);
      }

      const res = await fetch(`/api/admin/membership-applications/${selectedId}/chair-auth`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return { fileId: String(json?.fileId || ''), kind: String(json?.kind || '') };
    },
    onSuccess: async (d) => {
      setChairAuthFileId(d.fileId);
      await qc.invalidateQueries({ queryKey: ['membership_application_v2_detail', selectedId] });
      showToast(dict?.admin?.appsChairAuthUploaded || (isEn ? 'Uploaded.' : 'Nahráno.'), 'success');
    },
    onError: (e: any) => showToast(e?.message || (isEn ? 'Error' : 'Chyba'), 'error'),
  });

  const decisionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      if (!chairAuthFileId) throw new Error(dict?.admin?.appsChairAuthMissing || (isEn ? 'Missing chair auth.' : 'Chybí podpis/razítko předsedy.'));

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const res = await fetch(`/api/admin/membership-applications/${selectedId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          decision: {
            status: decisionStatus,
            membershipType: decisionMembershipType,
            reason: decisionStatus === 'rejected' ? (decisionReason || null) : null,
            chairAuthKind,
            chairAuthFileId,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['membership_applications_v2'] }),
        qc.invalidateQueries({ queryKey: ['membership_application_v2_detail', selectedId] }),
      ]);
      showToast(dict?.admin?.alertStatusUpdated || (isEn ? 'Updated.' : 'Hotovo.'), 'success');
    },
    onError: (e: any) => showToast(e?.message || (isEn ? 'Error' : 'Chyba'), 'error'),
  });

  const submitEdit = handleSubmit((values) => {
    if (!isEditable) return;
    updateMutation.mutate(values);
  });

  const rows = listQuery.data?.rows || [];
  const count = listQuery.data?.count;
  const canPrev = page > 0;
  const canNext = typeof count === 'number' ? (page + 1) * PAGE_SIZE < count : rows.length === PAGE_SIZE;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={dict?.admin?.tabApplications || (isEn ? 'Applications' : 'Přihlášky')}
        description={dict?.admin?.appsSubtitle || (isEn ? 'Membership applications review' : 'Správa a schvalování členských přihlášek (v2)')}
      />

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-5">
        <div className="grid lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-7 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder={dict?.admin?.appsSearchPlaceholder || (isEn ? 'Search name / email / phone…' : 'Hledat jméno / e‑mail / telefon…')}
              className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.common?.status || (isEn ? 'Status' : 'Stav')}</div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any);
                setPage(0);
              }}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
            >
              <option value="pending">{dict?.admin?.appsStatusPending || (isEn ? 'Pending' : 'Čeká')}</option>
              <option value="approved">{dict?.admin?.appsStatusApproved || (isEn ? 'Approved' : 'Schváleno')}</option>
              <option value="rejected">{dict?.admin?.appsStatusRejected || (isEn ? 'Rejected' : 'Zamítnuto')}</option>
              <option value="all">{dict?.admin?.appsStatusAll || (isEn ? 'All' : 'Vše')}</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center justify-end gap-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 rounded-2xl border border-stone-100">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                {typeof count === 'number' ? count : rows.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {listQuery.isLoading ? (
        <SkeletonTabContent />
      ) : listQuery.error ? (
        <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">{dict?.admin?.appsLoadFailed || (isEn ? 'Failed to load.' : 'Nelze načíst přihlášky.')}</div>
      ) : rows.length === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title={dict?.admin?.emptyApplications || (isEn ? 'No applications' : 'Žádné přihlášky')}
          description={dict?.admin?.appsEmptyDesc || (isEn ? 'New applications will appear here.' : 'Až někdo odešle přihlášku, zobrazí se tady.')}
        />
      ) : (
        <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  <th className="py-4 px-4">{dict?.admin?.appsColApplicant || (isEn ? 'Applicant' : 'Žadatel')}</th>
                  <th className="py-4 px-4">{dict?.admin?.appsColStatus || (isEn ? 'Status' : 'Stav')}</th>
                  <th className="py-4 px-4">{dict?.admin?.appsColSubmitted || (isEn ? 'Submitted' : 'Podáno')}</th>
                  <th className="py-4 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const active = selectedId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-stone-100 transition cursor-pointer ${active ? 'bg-green-50/30' : 'hover:bg-stone-50'}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="py-4 px-4">
                        <div className="font-black tracking-tight text-stone-900">{r?.meta?.first_name || r?.name || '—'} {r?.meta?.last_name || ''}</div>
                        <div className="text-xs text-stone-500 font-medium truncate max-w-[520px]">{r.email || ''}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${statusBadge(String(r.status || ''))}`}>
                          {String(r.status || '')}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-2">
                          <Clock size={14} />
                          {r.createdAt ? formatDatePrague(r.createdAt, isEn ? 'en' : 'cs') : '—'}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(r.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                        >
                          <Pencil size={16} />
                          {dict?.admin?.appsOpenDetail || (isEn ? 'Detail' : 'Detail')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-6 flex items-center justify-between gap-3">
            <div className="text-xs text-stone-500 font-bold">
              {typeof count === 'number' ? (
                <>
                  {dict?.admin?.appsShowing || (isEn ? 'Showing' : 'Zobrazeno')} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} {dict?.admin?.appsOf || (isEn ? 'of' : 'z')} {count}
                </>
              ) : (
                <>
                  {dict?.admin?.appsShowing || (isEn ? 'Showing' : 'Zobrazeno')} {rows.length}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                {dict?.admin?.pagination?.previous || (isEn ? 'Previous' : 'Předchozí')}
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                {dict?.admin?.pagination?.next || (isEn ? 'Next' : 'Další')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Drawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        side="right"
        overlayClassName="fixed inset-0 z-[25000] flex"
        panelClassName="relative h-full w-[980px] max-w-[95vw] bg-white border-l border-stone-100 overflow-y-auto"
      >
        <div className="p-8 border-b border-stone-100 flex items-start justify-between gap-6 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{dict?.admin?.appDetail || (isEn ? 'Application detail' : 'Detail přihlášky')}</div>
            <div className="text-2xl font-black text-stone-900 truncate">
              {selectedMeta?.first_name || ''} {selectedMeta?.last_name || ''}{!selectedMeta?.first_name && !selectedMeta?.last_name ? (selectedApplication?.name || '—') : ''}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${statusBadge(String(selectedApplication?.status || 'pending'))}`}>
                {String(selectedApplication?.status || 'pending')}
              </span>
              <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-stone-100 text-stone-700">
                ID: {String(selectedId || '').slice(0, 8)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400"
            title={dict?.common?.close || (isEn ? 'Close' : 'Zavřít')}
          >
            <XCircle size={22} />
          </button>
        </div>

        {detailQuery.isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : detailQuery.error ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">{dict?.admin?.appsDetailLoadFailed || (isEn ? 'Failed to load detail.' : 'Nelze načíst detail.')}</div>
        ) : selectedApplication ? (
          <div className="p-8 space-y-10">
            <div className="grid lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-8">
                <div className="rounded-[2.5rem] border border-stone-100 bg-white shadow-sm p-8 space-y-6">
                  <div className="flex items-center gap-3 text-stone-900">
                    <FileCheck size={20} className="text-stone-700" />
                    <h3 className="text-sm font-black uppercase tracking-widest">{dict?.admin?.applicantSignature || (isEn ? 'Applicant signature' : 'Podpis žadatele')}</h3>
                  </div>
                  <div className="rounded-[2rem] border border-stone-100 bg-stone-50 p-6 flex items-center justify-center min-h-[140px]">
                    {applicantSignatureQuery.isLoading ? (
                      <InlinePulse className="bg-stone-200" size={16} />
                    ) : applicantSignatureQuery.data ? (
                      <Image
                        src={applicantSignatureQuery.data}
                        alt={dict?.admin?.applicantSignature || 'Signature'}
                        width={640}
                        height={220}
                        className="max-w-full h-auto mix-blend-multiply"
                        unoptimized
                      />
                    ) : (
                      <div className="text-stone-400 font-bold text-sm">{dict?.admin?.missingSignature || (isEn ? 'Missing signature' : 'Chybí podpis')}</div>
                    )}
                  </div>
                </div>

                <form onSubmit={submitEdit} className="rounded-[2.5rem] border border-stone-100 bg-white shadow-sm p-8 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-stone-900">
                      <Pencil size={20} className="text-green-600" />
                      <h3 className="text-sm font-black uppercase tracking-widest">{dict?.admin?.appsEditTitle || (isEn ? 'Edit (before decision)' : 'Editace (před rozhodnutím)')}</h3>
                    </div>
                    {!isPending ? (
                      <span className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-stone-100 text-stone-700">
                        {dict?.admin?.appsReadOnlyAfterDecision || (isEn ? 'Read-only after decision' : 'Po rozhodnutí jen pro čtení')}
                      </span>
                    ) : readOnly ? (
                      <span className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-stone-100 text-stone-700">
                        {dict?.admin?.readOnly || (isEn ? 'Read-only' : 'Pouze pro čtení')}
                      </span>
                    ) : null}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.appsLang || (isEn ? 'Language' : 'Jazyk')}</label>
                      <select
                        {...register('application.meta.lang')}
                        disabled={!isEditable}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      >
                        <option value="cs">cs</option>
                        <option value="en">en</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.appsMembershipType || (isEn ? 'Membership type' : 'Typ členství')}</label>
                      <select
                        {...register('application.meta.membership_type')}
                        disabled={!isEditable}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      >
                        <option value="regular">{dict?.admin?.decisionTypeRegular || (isEn ? 'Regular' : 'Řádné')}</option>
                        <option value="external">{dict?.admin?.decisionTypeExternal || (isEn ? 'External' : 'Externí')}</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.labelFirstName || (isEn ? 'First name' : 'Jméno')}</label>
                      <input
                        {...register('application.meta.first_name')}
                        disabled={!isEditable}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.labelLastName || (isEn ? 'Last name' : 'Příjmení')}</label>
                      <input
                        {...register('application.meta.last_name')}
                        disabled={!isEditable}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Email</label>
                      <input
                        {...register('application.email')}
                        disabled={!isEditable}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.recruitment?.labelPhone || (isEn ? 'Phone' : 'Telefon')}</label>
                      <input
                        {...register('application.phone')}
                        disabled={!isEditable}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.recruitment?.labelAddress || (isEn ? 'Address' : 'Adresa')}</label>
                    <textarea
                      {...register('application.address')}
                      disabled={!isEditable}
                      className="w-full min-h-[90px] bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.motivation || (isEn ? 'Motivation' : 'Motivace')}</label>
                    <textarea
                      {...register('application.motivation')}
                      disabled={!isEditable}
                      className="w-full min-h-[90px] bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.recruitment?.labelUniversityEmail || (isEn ? 'University email' : 'Univerzitní e‑mail')}</label>
                      <input
                        {...register('application.meta.university_email')}
                        disabled={!isEditable || watch('application.meta.membership_type') !== 'regular'}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.recruitment?.labelStudyYear || (isEn ? 'Study year' : 'Ročník')}</label>
                      <input
                        {...register('application.meta.study_year')}
                        disabled={!isEditable || watch('application.meta.membership_type') !== 'regular'}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.recruitment?.labelFieldOfStudy || (isEn ? 'Field of study' : 'Obor')}</label>
                      <input
                        {...register('application.meta.field_of_study')}
                        disabled={!isEditable || watch('application.meta.membership_type') !== 'regular'}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.recruitment?.labelSignedOn || (isEn ? 'Signed on' : 'Podepsáno dne')}</label>
                      <input
                        {...register('application.meta.signed_on')}
                        disabled={!isEditable}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" {...register('application.meta.gdpr_consent')} disabled={!isEditable} className="w-4 h-4 accent-green-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{dict?.recruitment?.labelGdprConsent || (isEn ? 'GDPR consent' : 'GDPR souhlas')}</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.appsAddressMeta || (isEn ? 'Address meta (JSON)' : 'Adresa meta (JSON)')}</label>
                    <textarea
                      {...register('application.meta.address_meta_json')}
                      disabled={!isEditable}
                      className="w-full min-h-[120px] bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-mono text-xs text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                    />
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.appsPdfSnapshotCs || (isEn ? 'PDF snapshot (CS) JSON' : 'PDF snapshot (CS) JSON')}</label>
                      <textarea
                        {...register('application.meta.pdf_snapshot_cs_json')}
                        disabled={!isEditable}
                        className="w-full min-h-[140px] bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-mono text-xs text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.appsPdfSnapshotEn || (isEn ? 'PDF snapshot (EN) JSON' : 'PDF snapshot (EN) JSON')}</label>
                      <textarea
                        {...register('application.meta.pdf_snapshot_en_json')}
                        disabled={!isEditable}
                        className="w-full min-h-[140px] bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-mono text-xs text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100">
                    <button
                      type="submit"
                      disabled={!isEditable || updateMutation.isPending}
                      className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {updateMutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />}
                      {dict?.common?.saveChanges || (isEn ? 'Save' : 'Uložit')}
                    </button>
                  </div>
                </form>
              </div>

              <div className="lg:col-span-5 space-y-8">
                <div className="rounded-[2.5rem] border border-stone-100 bg-white shadow-sm p-8 space-y-6">
                  <div className="flex items-center gap-3 text-stone-900">
                    <FileText size={20} className="text-stone-700" />
                    <h3 className="text-sm font-black uppercase tracking-widest">{dict?.admin?.appsDecisionTitle || (isEn ? 'Decision' : 'Rozhodnutí')}</h3>
                  </div>

                  {isPending ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setDecisionStatus('approved')}
                          className={`rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border transition ${
                            decisionStatus === 'approved'
                              ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-900/20'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <CheckCircle className="inline-block mr-2" size={14} />
                          {dict?.admin?.btnApprove || (isEn ? 'Approve' : 'Schválit')}
                        </button>
                        <button
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setDecisionStatus('rejected')}
                          className={`rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border transition ${
                            decisionStatus === 'rejected'
                              ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-900/20'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <XCircle className="inline-block mr-2" size={14} />
                          {dict?.admin?.btnReject || (isEn ? 'Reject' : 'Odmítnout')}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.decisionMembershipType || (isEn ? 'Membership (decision)' : 'Typ členství (rozhodnutí)')}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={!isEditable}
                            onClick={() => setDecisionMembershipType('regular')}
                            className={`rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border transition ${
                              decisionMembershipType === 'regular'
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            {dict?.admin?.decisionTypeRegular || (isEn ? 'Regular' : 'Řádné')}
                          </button>
                          <button
                            type="button"
                            disabled={!isEditable}
                            onClick={() => setDecisionMembershipType('external')}
                            className={`rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border transition ${
                              decisionMembershipType === 'external'
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            {dict?.admin?.decisionTypeExternal || (isEn ? 'External' : 'Externí')}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.appsChairAuthTitle || (isEn ? 'Chair authorization' : 'Autorizace předsedy')}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={!isEditable}
                            onClick={() => setChairAuthKind('signature')}
                            className={`rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border transition ${
                              chairAuthKind === 'signature'
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            {dict?.admin?.appsChairAuthSignature || (isEn ? 'Signature' : 'Podpis')}
                          </button>
                          <button
                            type="button"
                            disabled={!isEditable}
                            onClick={() => setChairAuthKind('stamp')}
                            className={`rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border transition ${
                              chairAuthKind === 'stamp'
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            {dict?.admin?.appsChairAuthStamp || (isEn ? 'Stamp' : 'Razítko')}
                          </button>
                        </div>
                      </div>

                      {chairAuthKind === 'signature' ? (
                        <div className="space-y-3">
                          <div className="bg-white rounded-[2rem] overflow-hidden border border-stone-200">
                            <SignaturePad
                              onSave={(dataUrl) => setChairSignatureDataUrl(dataUrl)}
                              onClear={() => setChairSignatureDataUrl('')}
                              clearLabel={dict?.recruitment?.btnClear || (isEn ? 'Clear' : 'Smazat')}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={!isEditable || chairAuthUploadMutation.isPending || !chairSignatureDataUrl}
                            onClick={() => chairAuthUploadMutation.mutate({ kind: 'signature', dataUrl: chairSignatureDataUrl })}
                            className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {chairAuthUploadMutation.isPending ? <InlinePulse className="bg-stone-200" size={14} /> : <Upload size={16} />}
                            {dict?.admin?.appsUploadChairAuth || (isEn ? 'Upload' : 'Nahrát')}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <input
                            type="file"
                            accept="image/*"
                            disabled={!isEditable}
                            onChange={(e) => setStampFile(e.target.files?.[0] || null)}
                            className="w-full text-sm"
                          />
                          <button
                            type="button"
                            disabled={!isEditable || chairAuthUploadMutation.isPending || !stampFile}
                            onClick={() => {
                              if (!stampFile) return;
                              chairAuthUploadMutation.mutate({ kind: 'stamp', file: stampFile });
                            }}
                            className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {chairAuthUploadMutation.isPending ? <InlinePulse className="bg-stone-200" size={14} /> : <Upload size={16} />}
                            {dict?.admin?.appsUploadChairAuth || (isEn ? 'Upload' : 'Nahrát')}
                          </button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.admin?.rejectionReason || (isEn ? 'Reason (optional)' : 'Důvod odmítnutí (volitelné)')}</label>
                        <textarea
                          value={decisionReason}
                          onChange={(e) => setDecisionReason(e.target.value)}
                          disabled={!isEditable || decisionStatus !== 'rejected'}
                          className="w-full min-h-[80px] bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                          placeholder={dict?.admin?.rejectionPlaceholder || (isEn ? 'Optional…' : 'Volitelné…')}
                        />
                      </div>

                      <button
                        type="button"
                        disabled={!isEditable || decisionMutation.isPending}
                        onClick={() => decisionMutation.mutate()}
                        className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {decisionMutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />}
                        {dict?.admin?.appsFinalizeDecision || (isEn ? 'Finalize decision' : 'Uzavřít rozhodnutí')}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="rounded-2xl bg-stone-50 border border-stone-100 p-6">
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{dict?.admin?.appsDecidedAt || (isEn ? 'Decided at' : 'Rozhodnuto dne')}</span>
                            <span className="text-xs font-black text-stone-900">
                              {selectedDecision?.decided_at ? formatDateTimePrague(selectedDecision.decided_at, isEn ? 'en' : 'cs') : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{dict?.admin?.appsDecidedBy || (isEn ? 'Decided by' : 'Rozhodl')}</span>
                            <span className="text-xs font-black text-stone-900 break-all text-right">{selectedDecision?.decided_by_email || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{dict?.admin?.decisionMembershipType || (isEn ? 'Membership' : 'Typ členství')}</span>
                            <span className="text-xs font-black text-stone-900">{selectedDecision?.membership_type || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {selectedApplication?.decision_reason ? (
                        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-sm font-bold text-red-800">
                          {String(selectedApplication.decision_reason)}
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{dict?.admin?.appsChairAuthTitle || (isEn ? 'Chair authorization' : 'Autorizace předsedy')}</div>
                        <div className="rounded-[2rem] border border-stone-100 bg-stone-50 p-6 flex items-center justify-center min-h-[140px]">
                          {chairAuthSignedUrlQuery.isLoading ? (
                            <InlinePulse className="bg-stone-200" size={16} />
                          ) : chairAuthSignedUrlQuery.data ? (
                            <Image
                              src={chairAuthSignedUrlQuery.data}
                              alt={dict?.admin?.appsChairAuthTitle || 'Chair auth'}
                              width={640}
                              height={220}
                              className="max-w-full h-auto mix-blend-multiply"
                              unoptimized
                            />
                          ) : (
                            <div className="text-stone-400 font-bold text-sm">{dict?.admin?.appsChairAuthMissing || (isEn ? 'Missing chair auth' : 'Chybí podpis/razítko')}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-[2.5rem] border border-stone-100 bg-white shadow-sm p-8 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{dict?.admin?.appsMetaTitle || (isEn ? 'Meta' : 'Meta')}</div>
                  <div className="grid gap-2 text-xs font-bold text-stone-700">
                    <div>{dict?.admin?.appsSubmittedAt || (isEn ? 'Submitted at' : 'Podáno')}: {selectedApplication?.created_at ? formatDateTimePrague(selectedApplication.created_at, isEn ? 'en' : 'cs') : '—'}</div>
                    <div>{dict?.admin?.appsUpdatedAt || (isEn ? 'Updated at' : 'Změněno')}: {selectedApplication?.updated_at ? formatDateTimePrague(selectedApplication.updated_at, isEn ? 'en' : 'cs') : '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
