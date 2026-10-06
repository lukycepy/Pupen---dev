'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock, FileText, FileCheck, Mail, Pencil, RefreshCw, Save, Search, ShieldCheck, Upload, Users, XCircle } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import Image from 'next/image';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import Drawer from '@/app/components/ui/Drawer';
import InlinePulse from '@/app/components/InlinePulse';
import SignaturePad from '../../../components/SignaturePad';
import { formatDatePrague, formatDateTimePrague } from '@/lib/time/prague';
import { useForm, useWatch } from 'react-hook-form';
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
  provisioning?: {
    userId?: string | null;
    roleId?: string | null;
    roleName?: string | null;
    memberNo?: number | null;
    accessEmailQueued?: boolean;
    accessEmailSentAt?: string | null;
    accessEmailSentBy?: string | null;
    accessEmailResent?: boolean;
  } | null;
  dedupe?: {
    duplicateApplicationCount?: number;
    duplicateProfileCount?: number;
    sameEmailApplications?: Array<{ id?: string | null; status?: string | null; createdAt?: string | null; name?: string | null }>;
    sameEmailProfiles?: Array<{
      id?: string | null;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      isMember?: boolean;
      isAdmin?: boolean;
      createdAt?: string | null;
    }>;
    review?: {
      reviewedAt?: string | null;
      reviewedBy?: string | null;
      primaryProfileId?: string | null;
      note?: string | null;
    } | null;
  } | null;
};

type SummaryResponse = {
  stats?: {
    pendingCount?: number;
    approvedCount?: number;
    rejectedCount?: number;
    approvedWithoutUserIdCount?: number;
    approvedWithoutAccessLogCount?: number;
    duplicateApplicationEmailCount?: number;
    duplicateProfileEmailCount?: number;
    reviewedDuplicateApplicationCount?: number;
  };
  issues?: {
    approvedWithoutUserId?: Array<{ id?: string | null; email?: string | null; createdAt?: string | null }>;
    approvedWithoutAccessLog?: Array<{ id?: string | null; email?: string | null; createdAt?: string | null }>;
    duplicateApplicationEmails?: Array<{ email?: string | null; count?: number | null; sampleApplicationId?: string | null }>;
    duplicateProfileEmails?: Array<{ email?: string | null; count?: number | null }>;
  };
};

type MergePreviewResponse = {
  ok?: true;
  membershipRolesToMove?: Array<{ roleId: string; roleName: string }>;
  membershipRolesAlreadyOnTarget?: Array<{ roleId: string; roleName: string }>;
  applicationsToRelink?: Array<{ id: string; status: string | null }>;
  targetProfilePatchPreview?: Record<string, unknown>;
  sourceHasMemberNo?: boolean;
  targetHasMemberNo?: boolean;
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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid JSON';
    return { ok: false, error: message };
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
  const [selectedPrimaryProfileId, setSelectedPrimaryProfileId] = useState('');
  const [dedupeNote, setDedupeNote] = useState('');

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

  const summaryQuery = useQuery({
    queryKey: ['membership_applications_v2_summary'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/membership-applications/summary', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json as SummaryResponse;
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
  const selectedMeta = useMemo(
    () => (selectedApplication?.meta && typeof selectedApplication.meta === 'object' ? selectedApplication.meta : {}),
    [selectedApplication],
  );
  const selectedDecision = useMemo(
    () => (selectedMeta?.decision && typeof selectedMeta.decision === 'object' ? selectedMeta.decision : {}),
    [selectedMeta],
  );
  const selectedProvisioning = detailQuery.data?.provisioning || null;
  const selectedDedupe = detailQuery.data?.dedupe || null;
  const sourceMergeProfileId = String(selectedProvisioning?.userId || '');
  const targetMergeProfileId = String(selectedPrimaryProfileId || '');

  const mergePreviewQuery = useQuery({
    queryKey: ['membership_application_merge_preview', selectedId, sourceMergeProfileId, targetMergeProfileId],
    enabled: !!selectedId && !!sourceMergeProfileId && !!targetMergeProfileId && sourceMergeProfileId !== targetMergeProfileId,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const params = new URLSearchParams({
        sourceProfileId: sourceMergeProfileId,
        targetProfileId: targetMergeProfileId,
      });
      const res = await fetch(`/api/admin/membership-applications/${selectedId}/merge-preview?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json as MergePreviewResponse;
    },
  });

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

  const { register, handleSubmit, reset } = form;
  const membershipType = useWatch({
    control: form.control,
    name: 'application.meta.membership_type',
  });

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
    setSelectedPrimaryProfileId(String(detailQuery.data?.dedupe?.review?.primaryProfileId || ''));
    setDedupeNote(String(detailQuery.data?.dedupe?.review?.note || ''));
  }, [reset, selectedApplication, selectedDecision, selectedMeta, detailQuery.data]);

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
      return json as { userId?: string | null; memberNo?: number | null; accessEmailQueued?: boolean };
    },
    onSuccess: async (data) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['membership_applications_v2'] }),
        qc.invalidateQueries({ queryKey: ['membership_application_v2_detail', selectedId] }),
      ]);
      const suffix =
        data?.userId
          ? isEn
            ? ` Access sent for user ${String(data.userId).slice(0, 8)}.`
            : ` Přístup odeslán pro uživatele ${String(data.userId).slice(0, 8)}.`
          : '';
      showToast(`${dict?.admin?.alertStatusUpdated || (isEn ? 'Updated.' : 'Hotovo.')}${suffix}`, 'success');
    },
    onError: (e: any) => showToast(e?.message || (isEn ? 'Error' : 'Chyba'), 'error'),
  });

  const resendAccessMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const res = await fetch(`/api/admin/membership-applications/${selectedId}/send-access`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json as { userId?: string | null };
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['membership_application_v2_detail', selectedId] });
      showToast(
        isEn
          ? `Access email re-sent${data?.userId ? ` for ${String(data.userId).slice(0, 8)}` : ''}.`
          : `Přístupový e-mail znovu odeslán${data?.userId ? ` pro ${String(data.userId).slice(0, 8)}` : ''}.`,
        'success',
      );
    },
    onError: (e: any) => showToast(e?.message || (isEn ? 'Error' : 'Chyba'), 'error'),
  });

  const dedupeReviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/membership-applications/${selectedId}/dedupe-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          primaryProfileId: selectedPrimaryProfileId || null,
          note: dedupeNote || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json as { primaryProfileId?: string | null };
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['membership_application_v2_detail', selectedId] }),
        qc.invalidateQueries({ queryKey: ['membership_applications_v2_summary'] }),
      ]);
      showToast(isEn ? 'Duplicate review saved.' : 'Kontrola duplicity uložena.', 'success');
    },
    onError: (e: any) => showToast(e?.message || (isEn ? 'Error' : 'Chyba'), 'error'),
  });

  const mergeApplyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Missing id');
      const sourceProfileId = String(selectedProvisioning?.userId || '');
      const targetProfileId = String(selectedPrimaryProfileId || '');
      if (!sourceProfileId || !targetProfileId) throw new Error(isEn ? 'Missing merge pair.' : 'Chybí merge dvojice.');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/membership-applications/${selectedId}/merge-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sourceProfileId, targetProfileId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json as {
        rolesInserted?: number;
        rolesRemovedFromSource?: number;
        applicationsRelinked?: number;
        applicationsBlockedByDbGuard?: boolean;
        warnings?: string[];
      };
    },
    onSuccess: async (data) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['membership_application_v2_detail', selectedId] }),
        qc.invalidateQueries({ queryKey: ['membership_applications_v2_summary'] }),
        qc.invalidateQueries({ queryKey: ['membership_application_merge_preview', selectedId, selectedProvisioning?.userId, selectedPrimaryProfileId] }),
      ]);
      const warningText =
        data?.applicationsBlockedByDbGuard
          ? isEn
            ? ' DB guard still blocks application relink.'
            : ' DB guard zatím blokuje relink přihlášek.'
          : '';
      showToast(
        isEn
          ? `Merge prep applied. ${data?.rolesInserted || 0} roles moved, ${data?.applicationsRelinked || 0} applications relinked.${warningText}`
          : `Merge prep proveden. Presunuto ${data?.rolesInserted || 0} rolí, přepojeno ${data?.applicationsRelinked || 0} přihlášek.${warningText}`,
        'success',
      );
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

      {summaryQuery.data ? (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: isEn ? 'Pending applications' : 'Čekající přihlášky',
                value: summaryQuery.data.stats?.pendingCount ?? 0,
                icon: Clock,
                tone: 'text-amber-700',
                bg: 'bg-amber-50',
              },
              {
                label: isEn ? 'Approved without user' : 'Schválené bez účtu',
                value: summaryQuery.data.stats?.approvedWithoutUserIdCount ?? 0,
                icon: AlertTriangle,
                tone: 'text-red-700',
                bg: 'bg-red-50',
              },
              {
                label: isEn ? 'Approved without access mail' : 'Schválené bez access mailu',
                value: summaryQuery.data.stats?.approvedWithoutAccessLogCount ?? 0,
                icon: Mail,
                tone: 'text-orange-700',
                bg: 'bg-orange-50',
              },
              {
                label: isEn ? 'Duplicate emails' : 'Duplicitní e-maily',
                value: (summaryQuery.data.stats?.duplicateApplicationEmailCount ?? 0) + (summaryQuery.data.stats?.duplicateProfileEmailCount ?? 0),
                icon: Users,
                tone: 'text-blue-700',
                bg: 'bg-blue-50',
              },
              {
                label: isEn ? 'Reviewed duplicates' : 'Zkontrolované duplicity',
                value: summaryQuery.data.stats?.reviewedDuplicateApplicationCount ?? 0,
                icon: CheckCircle,
                tone: 'text-emerald-700',
                bg: 'bg-emerald-50',
              },
            ].map((card) => (
              <div key={card.label} className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.bg} ${card.tone}`}>
                  <card.icon size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{card.label}</div>
                  <div className="text-2xl font-black text-stone-900">{card.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid xl:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-stone-900">
                <AlertTriangle size={18} className="text-red-600" />
                <h3 className="text-sm font-black uppercase tracking-widest">{isEn ? 'Provisioning issues' : 'Provisioning problémy'}</h3>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{isEn ? 'Approved without user id' : 'Schválené bez user ID'}</div>
                  <div className="mt-2 space-y-2">
                    {(summaryQuery.data.issues?.approvedWithoutUserId || []).length ? (
                      (summaryQuery.data.issues?.approvedWithoutUserId || []).map((item) => (
                        <button
                          key={`nouser-${item.id}`}
                          type="button"
                          onClick={() => item.id && setSelectedId(String(item.id))}
                          className="w-full text-left rounded-xl border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50 transition"
                        >
                          <div className="text-xs font-black text-stone-900 break-all">{item.email || item.id || '—'}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                            {item.createdAt ? formatDateTimePrague(item.createdAt, isEn ? 'en' : 'cs') : '—'}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-xs font-bold text-stone-500">{isEn ? 'No blocked provisioning found.' : 'Nenalezen žádný blokovaný provisioning.'}</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{isEn ? 'Approved without access email' : 'Schválené bez access e-mailu'}</div>
                  <div className="mt-2 space-y-2">
                    {(summaryQuery.data.issues?.approvedWithoutAccessLog || []).length ? (
                      (summaryQuery.data.issues?.approvedWithoutAccessLog || []).map((item) => (
                        <button
                          key={`nolog-${item.id}`}
                          type="button"
                          onClick={() => item.id && setSelectedId(String(item.id))}
                          className="w-full text-left rounded-xl border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50 transition"
                        >
                          <div className="text-xs font-black text-stone-900 break-all">{item.email || item.id || '—'}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                            {item.createdAt ? formatDateTimePrague(item.createdAt, isEn ? 'en' : 'cs') : '—'}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-xs font-bold text-stone-500">{isEn ? 'All approved applications have access logs.' : 'Všechny schválené přihlášky mají access log.'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-stone-900">
                <Users size={18} className="text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-widest">{isEn ? 'Duplicate emails' : 'Duplicitní e-maily'}</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{isEn ? 'Applications' : 'Přihlášky'}</div>
                  <div className="mt-2 space-y-2">
                    {(summaryQuery.data.issues?.duplicateApplicationEmails || []).length ? (
                      (summaryQuery.data.issues?.duplicateApplicationEmails || []).map((item) => (
                        <button
                          key={`appdup-${item.email}`}
                          type="button"
                          onClick={() => item.sampleApplicationId && setSelectedId(String(item.sampleApplicationId))}
                          className="w-full text-left rounded-xl border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50 transition"
                        >
                          <div className="text-xs font-black text-stone-900 break-all">{item.email || '—'}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                            {isEn ? `${item.count || 0} records` : `${item.count || 0} záznamů`}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-xs font-bold text-stone-500">{isEn ? 'No duplicate application emails.' : 'Bez duplicit v přihláškách.'}</div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{isEn ? 'Profiles' : 'Profily'}</div>
                  <div className="mt-2 space-y-2">
                    {(summaryQuery.data.issues?.duplicateProfileEmails || []).length ? (
                      (summaryQuery.data.issues?.duplicateProfileEmails || []).map((item) => (
                        <div key={`profdup-${item.email}`} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                          <div className="text-xs font-black text-stone-900 break-all">{item.email || '—'}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                            {isEn ? `${item.count || 0} profiles` : `${item.count || 0} profilů`}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs font-bold text-stone-500">{isEn ? 'No duplicate profile emails.' : 'Bez duplicit v profilech.'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

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
                        disabled={!isEditable || membershipType !== 'regular'}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.recruitment?.labelStudyYear || (isEn ? 'Study year' : 'Ročník')}</label>
                      <input
                        {...register('application.meta.study_year')}
                        disabled={!isEditable || membershipType !== 'regular'}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict?.recruitment?.labelFieldOfStudy || (isEn ? 'Field of study' : 'Obor')}</label>
                      <input
                        {...register('application.meta.field_of_study')}
                        disabled={!isEditable || membershipType !== 'regular'}
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

                      {String(selectedApplication?.status || '') === 'approved' ? (
                        <div className="rounded-2xl bg-green-50 border border-green-100 p-6 space-y-4">
                          <div className="flex items-center gap-3 text-green-900">
                            <ShieldCheck size={18} />
                            <div className="text-[10px] font-black uppercase tracking-widest">
                              {isEn ? 'Account provisioning' : 'Provisioning účtu'}
                            </div>
                          </div>
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-green-700/70">
                                {isEn ? 'User id' : 'User ID'}
                              </span>
                              <span className="text-xs font-black text-green-950 break-all text-right">{selectedProvisioning?.userId || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-green-700/70">
                                {isEn ? 'Role' : 'Role'}
                              </span>
                              <span className="text-xs font-black text-green-950 text-right">{selectedProvisioning?.roleName || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-green-700/70">
                                {isEn ? 'Member no.' : 'Členské číslo'}
                              </span>
                              <span className="text-xs font-black text-green-950 text-right">
                                {typeof selectedProvisioning?.memberNo === 'number' ? selectedProvisioning.memberNo : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-green-700/70">
                                {isEn ? 'Access email' : 'Přístupový e-mail'}
                              </span>
                              <span className="text-xs font-black text-green-950 text-right">
                                {selectedProvisioning?.accessEmailQueued
                                  ? isEn
                                    ? 'Sent'
                                    : 'Odeslán'
                                  : isEn
                                    ? 'Pending'
                                    : 'Čeká'}
                              </span>
                            </div>
                            {selectedProvisioning?.accessEmailSentAt ? (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-green-700/70">
                                  {isEn ? 'Last sent' : 'Naposledy odesláno'}
                                </span>
                                <span className="text-xs font-black text-green-950 text-right">
                                  {formatDateTimePrague(selectedProvisioning.accessEmailSentAt, isEn ? 'en' : 'cs')}
                                </span>
                              </div>
                            ) : null}
                            {selectedProvisioning?.accessEmailSentBy ? (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-green-700/70">
                                  {isEn ? 'Sent by' : 'Odeslal'}
                                </span>
                                <span className="text-xs font-black text-green-950 break-all text-right">{selectedProvisioning.accessEmailSentBy}</span>
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={!!readOnly || resendAccessMutation.isPending}
                            onClick={() => resendAccessMutation.mutate()}
                            className="w-full bg-white text-green-900 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-green-200 hover:bg-green-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {resendAccessMutation.isPending ? <InlinePulse className="bg-green-300/60" size={14} /> : selectedProvisioning?.accessEmailQueued ? <RefreshCw size={16} /> : <Mail size={16} />}
                            {selectedProvisioning?.accessEmailQueued
                              ? isEn
                                ? 'Re-send access email'
                                : 'Znovu odeslat přístup'
                              : isEn
                                ? 'Send access email'
                                : 'Odeslat přístup'}
                          </button>
                        </div>
                      ) : null}

                      {(selectedDedupe?.duplicateApplicationCount || 0) > 0 || (selectedDedupe?.duplicateProfileCount || 0) > 0 ? (
                        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-6 space-y-4">
                          <div className="flex items-center gap-3 text-blue-900">
                            <Users size={18} />
                            <div className="text-[10px] font-black uppercase tracking-widest">
                              {isEn ? 'Duplicate review' : 'Kontrola duplicit'}
                            </div>
                          </div>
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-blue-700/70">
                                {isEn ? 'Other applications' : 'Další přihlášky'}
                              </span>
                              <span className="text-xs font-black text-blue-950">{selectedDedupe?.duplicateApplicationCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-blue-700/70">
                                {isEn ? 'Matching profiles' : 'Shodné profily'}
                              </span>
                              <span className="text-xs font-black text-blue-950">{selectedDedupe?.duplicateProfileCount || 0}</span>
                            </div>
                            {selectedDedupe?.review?.reviewedAt ? (
                              <div className="rounded-xl border border-blue-200 bg-white px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                                  {isEn ? 'Last review' : 'Poslední kontrola'}
                                </div>
                                <div className="mt-1 text-xs font-black text-blue-950">
                                  {formatDateTimePrague(String(selectedDedupe.review.reviewedAt), isEn ? 'en' : 'cs')}
                                </div>
                                <div className="mt-1 text-xs font-bold text-blue-800 break-all">
                                  {selectedDedupe.review.reviewedBy || '—'}
                                </div>
                                {selectedDedupe.review.note ? (
                                  <div className="mt-2 text-xs font-medium text-blue-900 whitespace-pre-wrap">{selectedDedupe.review.note}</div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {(selectedDedupe?.sameEmailProfiles || []).length ? (
                            <div className="space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-blue-700/70">
                                {isEn ? 'Candidate profiles' : 'Kandidátní profily'}
                              </div>
                              {(selectedDedupe?.sameEmailProfiles || []).map((profile) => {
                                const profileId = String(profile.id || '');
                                const active = profileId && profileId === selectedPrimaryProfileId;
                                return (
                                  <button
                                    key={`dedupe-profile-${profile.id}`}
                                    type="button"
                                    onClick={() => setSelectedPrimaryProfileId(active ? '' : profileId)}
                                    className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                                      active ? 'border-blue-600 bg-white shadow-sm' : 'border-blue-200 bg-white hover:bg-blue-100/40'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="min-w-0">
                                        <div className="text-xs font-black text-stone-900 break-all">
                                          {profile.firstName || profile.lastName ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : profile.email || profile.id || '—'}
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 break-all">
                                          {profile.id || '—'}
                                        </div>
                                      </div>
                                      <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                                        {active ? (isEn ? 'Primary' : 'Primární') : profile.isAdmin ? 'ADMIN' : profile.isMember ? 'ČLEN' : 'PROFIL'}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}

                          {(selectedDedupe?.sameEmailApplications || []).length ? (
                            <div className="space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-blue-700/70">
                                {isEn ? 'Other applications with same email' : 'Další přihlášky se stejným e-mailem'}
                              </div>
                              {(selectedDedupe?.sameEmailApplications || []).map((app) => (
                                <button
                                  key={`dedupe-app-${app.id}`}
                                  type="button"
                                  onClick={() => app.id && setSelectedId(String(app.id))}
                                  className="w-full text-left rounded-xl border border-blue-200 bg-white px-4 py-3 hover:bg-blue-100/40 transition"
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="text-xs font-black text-stone-900 break-all">{app.name || app.id || '—'}</div>
                                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                                        {app.createdAt ? formatDateTimePrague(app.createdAt, isEn ? 'en' : 'cs') : '—'}
                                      </div>
                                    </div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">{app.status || '—'}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-700/70">
                              {isEn ? 'Review note' : 'Poznámka ke kontrole'}
                            </label>
                            <textarea
                              value={dedupeNote}
                              onChange={(e) => setDedupeNote(e.target.value)}
                              className="w-full min-h-[88px] bg-white border border-blue-200 rounded-2xl px-4 py-3 font-medium text-stone-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
                              placeholder={isEn ? 'What was checked and which profile should stay primary?' : 'Co bylo zkontrolováno a který profil má zůstat primární?'}
                            />
                          </div>

                          <button
                            type="button"
                            disabled={dedupeReviewMutation.isPending}
                            onClick={() => dedupeReviewMutation.mutate()}
                            className="w-full bg-white text-blue-900 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {dedupeReviewMutation.isPending ? <InlinePulse className="bg-blue-300/60" size={14} /> : <CheckCircle size={16} />}
                            {isEn ? 'Mark duplicate as reviewed' : 'Označit duplicitu jako zkontrolovanou'}
                          </button>

                          {selectedProvisioning?.userId && selectedPrimaryProfileId && String(selectedProvisioning?.userId || '') !== String(selectedPrimaryProfileId || '') ? (
                            <div className="rounded-2xl border border-blue-200 bg-white p-4 space-y-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                                {isEn ? 'Merge prep preview' : 'Preview merge-prep'}
                              </div>
                              {mergePreviewQuery.isLoading ? (
                                <div className="py-3 flex items-center justify-center">
                                  <InlinePulse className="bg-blue-300/60" size={14} />
                                </div>
                              ) : mergePreviewQuery.error ? (
                                <div className="text-xs font-bold text-red-700">
                                  {isEn ? 'Preview failed.' : 'Preview selhalo.'}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="grid gap-2 text-xs font-bold text-stone-700">
                                    <div>
                                      {isEn ? 'Membership roles to move' : 'Členské role k přesunu'}: {(mergePreviewQuery.data?.membershipRolesToMove || []).length}
                                    </div>
                                    <div>
                                      {isEn ? 'Applications to relink' : 'Přihlášky k přepojení'}: {(mergePreviewQuery.data?.applicationsToRelink || []).length}
                                    </div>
                                    <div>
                                      {isEn ? 'Target profile patch fields' : 'Pole k doplnění cílového profilu'}: {Object.keys(mergePreviewQuery.data?.targetProfilePatchPreview || {}).length}
                                    </div>
                                  </div>
                                  {(mergePreviewQuery.data?.membershipRolesToMove || []).length ? (
                                    <div className="flex flex-wrap gap-2">
                                      {(mergePreviewQuery.data?.membershipRolesToMove || []).map((role) => (
                                        <span
                                          key={`merge-role-${role.roleId}`}
                                          className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-800"
                                        >
                                          {role.roleName}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                  {(mergePreviewQuery.data?.sourceHasMemberNo && !mergePreviewQuery.data?.targetHasMemberNo) ? (
                                    <div className="text-xs font-bold text-amber-700">
                                      {isEn ? 'Source keeps member number to stay non-destructive.' : 'Zdroj si ponechá členské číslo, aby merge zůstal ne-destruktivní.'}
                                    </div>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={mergeApplyMutation.isPending}
                                    onClick={() => mergeApplyMutation.mutate()}
                                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    {mergeApplyMutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />}
                                    {isEn ? 'Apply merge prep' : 'Provést merge-prep'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

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
