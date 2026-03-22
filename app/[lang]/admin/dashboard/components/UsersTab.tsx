'use client';

import React, { useState, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Edit3, Trash2, ShieldCheck, X, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import AdminModuleHeader from './ui/AdminModuleHeader';

function generatePassword(length = 10) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

interface UsersTabProps {
  dict: any;
}

const PAGE_SIZE = 60;

export default function UsersTab({ dict }: UsersTabProps) {
  const modules = [
    { id: 'events', label: dict.admin?.navEvents || 'Akce' },
    { id: 'news', label: dict.admin?.navNews || 'Novinky' },
    { id: 'messages', label: dict.admin?.tabMessages || 'Zprávy' },
    { id: 'partners', label: dict.admin?.navPartners || 'Partneři' },
    { id: 'faq', label: dict.admin?.navFaq || 'FAQ' },
    { id: 'feedback', label: dict.admin?.tabFeedback || 'Feedback' },
    { id: 'apps', label: dict.admin?.tabApplications || 'Přihlášky' },
    { id: 'budget', label: dict.admin?.tabBudget || 'Účetnictví' },
    { id: 'assets', label: dict.admin?.navAssets || 'Majetek' },
    { id: 'documents', label: dict.admin?.navDocs || 'Dokumenty' },
    { id: 'guide', label: dict.admin?.navGuide || 'Průvodce' },
    { id: 'hunts', label: dict.admin?.navHunts || 'Bojovky' },
    { id: 'map', label: dict.admin?.navMap || 'Mapa' },
    { id: 'meetings', label: dict.admin?.navMeetings || 'Schůze' },
    { id: 'quizzes', label: dict.admin?.navQuizzes || 'Kvízy' },
    { id: 'jobs', label: dict.admin?.navJobs || 'Práce' },
    { id: 'hours', label: dict.admin?.navHours || 'Otevírací doba' },
    { id: 'archive', label: dict.admin?.navArchive || 'Archiv' },
    { id: 'gallery', label: dict.admin?.tabGallery || 'Galerie' },
    { id: 'logs', label: dict.admin?.navLogs || 'Logy' },
    { id: 'analytics', label: dict.admin?.tabAnalytics || 'Analytika' },
    { id: 'blog_mod', label: dict.admin?.tabBlog || 'Moderace blogu' },
    { id: 'member_portal', label: dict.nav?.memberPortal || 'Členský portál' },
    { id: 'reviews', label: dict.admin?.tabReviews || 'Recenze' },
  ];
  const permsSchema: any = {};
  modules.forEach(m => {
    permsSchema[`can_view_${m.id}`] = z.boolean();
    permsSchema[`can_edit_${m.id}`] = z.boolean();
  });

  const userSchema = z.object({
    email: z.string().email(dict.admin.validation.email),
    password: z.string().optional(),
    first_name: z.string().min(1, dict.admin.validation.required),
    last_name: z.string().min(1, dict.admin.validation.required),
    is_admin: z.boolean().default(false),
    is_member: z.boolean().default(false),
    member_since: z.string().optional(),
    application_scan_url: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    date_of_birth: z.string().optional(),
    application_received_at: z.string().optional(),
    notes_internal: z.string().optional(),
    ...permsSchema,
    // Zpětná kompatibilita
    can_manage_admins: z.boolean().optional(),
  });

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [bulkText, setBulkText] = useState('');
  const [bulkDefaultRole, setBulkDefaultRole] = useState<'member' | 'admin'>('member');
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanDoc, setScanDoc] = useState<any>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [sendingPassword, setSendingPassword] = useState(false);

  const sendResetLink = async (email: string) => {
    setSendingReset(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/users/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast('Odesláno', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSendingReset(false);
    }
  };

  const parseBulkUsers = (text: string) => {
    const lines = String(text || '')
      .split(/\r?\n/g)
      .map(l => l.trim())
      .filter(Boolean);

    const out: any[] = [];
    for (const line of lines) {
      const parts = line.includes(';') ? line.split(';') : line.includes(',') ? line.split(',') : line.split(/\s+/g);
      const email = String(parts[0] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      const first_name = String(parts[1] || '').trim();
      const last_name = String(parts[2] || '').trim();
      const roleRaw = String(parts[3] || '').trim().toLowerCase();
      const role = roleRaw === 'admin' || roleRaw === 'a' ? 'admin' : roleRaw === 'member' || roleRaw === 'm' ? 'member' : bulkDefaultRole;

      out.push({
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        is_admin: role === 'admin',
        is_member: role === 'member' ? true : false,
        send_password: true,
      });
    }
    return out;
  };

  const adminsQuery = useInfiniteQuery({
    queryKey: ['admins_paged'],
    queryFn: async ({ pageParam }) => {
      const from = typeof pageParam === 'number' ? pageParam : 0;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,is_admin,is_member,can_manage_admins')
        .eq('is_admin', true)
        .order('last_name', { ascending: true })
        .range(from, to);
      if (res.error) throw res.error;
      const items = res.data || [];
      return { items, nextFrom: items.length === PAGE_SIZE ? to + 1 : null };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextFrom,
  });

  const membersQuery = useInfiniteQuery({
    queryKey: ['members_paged'],
    queryFn: async ({ pageParam }) => {
      const from = typeof pageParam === 'number' ? pageParam : 0;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,is_admin,is_member,can_manage_admins')
        .eq('is_member', true)
        .eq('is_admin', false)
        .order('last_name', { ascending: true })
        .range(from, to);
      if (res.error) throw res.error;
      const items = res.data || [];
      return { items, nextFrom: items.length === PAGE_SIZE ? to + 1 : null };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextFrom,
  });

  const admins = (adminsQuery.data?.pages || []).flatMap((p) => p.items);
  const members = (membersQuery.data?.pages || []).flatMap((p) => p.items);

  const defaultPerms: any = {};
  modules.forEach(m => {
    defaultPerms[`can_view_${m.id}`] = false;
    defaultPerms[`can_edit_${m.id}`] = false;
  });

  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<any>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      is_admin: false,
      is_member: false,
      can_manage_admins: false,
      ...defaultPerms
    }
  });

  const passwordValue = watch('password');

  const sendNewPasswordNow = handleSubmit(async (data: any) => {
    if (!editingAdmin) return;
    const pwd = String(data?.password || '');
    if (!pwd) {
      showToast('Zadejte nové heslo', 'error');
      return;
    }
    setSendingPassword(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const patchRes = await fetch(`/api/admin/users/${editingAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: pwd }),
      });
      const patchJson = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) throw new Error(patchJson?.error || 'Chyba');

      const sendRes = await fetch('/api/admin/send-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: String(editingAdmin.email || ''), password: pwd, firstName: String(data?.first_name || '') }),
      });
      const sendJson = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) throw new Error(sendJson?.error || 'Chyba');

      showToast('Odesláno', 'success');
      setValue('password', '');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSendingPassword(false);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // 1. Příprava payloadu pro tabulku 'profiles'
      const profilePayload: any = {
        first_name: data.first_name,
        last_name: data.last_name,
        is_admin: !!data.is_admin,
        is_member: !!data.is_member,
        member_since: data.member_since || null,
        can_manage_admins: !!data.can_manage_admins,
        ...modules.reduce((acc: any, mod) => ({
          ...acc,
          [`can_view_${mod.id}`]: !!data[`can_view_${mod.id}`],
          [`can_edit_${mod.id}`]: !!data[`can_edit_${mod.id}`],
        }), {}),
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      if (editingAdmin) {
        const res = await fetch(`/api/admin/users/${editingAdmin.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...profilePayload, password: data.password || '' }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Chyba');

        const adminProfilePayload: any = {
          member_id: editingAdmin.id,
          updated_at: new Date().toISOString(),
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          date_of_birth: data.date_of_birth ? String(data.date_of_birth) : null,
          application_received_at: data.application_received_at ? new Date(String(data.application_received_at)).toISOString() : null,
          notes_internal: data.notes_internal?.trim() || null,
        };
        const { error: apErr } = await supabase.from('member_admin_profile').upsert([adminProfilePayload], { onConflict: 'member_id' });
        if (apErr) throw apErr;
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...profilePayload, email: data.email, password: data.password || '', send_password: true }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Chyba');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins_paged'] });
      queryClient.invalidateQueries({ queryKey: ['members_paged'] });
      handleCancel();
      showToast(dict.admin.alertAdminSuccess, 'success');
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Chyba');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins_paged'] });
      queryClient.invalidateQueries({ queryKey: ['members_paged'] });
      showToast(dict.admin.confirmDeleteSuccess || 'Smazáno', 'success');
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  const bulkMutation = useMutation({
    mutationFn: async (payload: { users: any[] }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return json;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admins_paged'] });
      queryClient.invalidateQueries({ queryKey: ['members_paged'] });
      const results = Array.isArray(data?.results) ? data.results : [];
      const okCount = results.filter((r: any) => r?.ok).length;
      const errCount = results.length - okCount;
      showToast(`Hromadně přidáno/aktualizováno: ${okCount}${errCount ? `, chyby: ${errCount}` : ''}`, errCount ? 'info' : 'success');
      setBulkText('');
    },
    onError: (err: any) => {
      showToast(err?.message || 'Chyba', 'error');
    },
  });

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  const uploadScan = async () => {
    if (!editingAdmin?.id) throw new Error('Nejdřív vyber člena.');
    if (!scanFile) throw new Error('Vyber soubor.');
    setScanBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const userId = sessionData.session?.user?.id || null;
      if (!token) throw new Error('Unauthorized');

      const safeName = scanFile.name.replace(/[^\w.\-]+/g, '_');
      const path = `applications/${editingAdmin.id}/${Date.now()}-${safeName}`;
      const form = new FormData();
      form.set('file', scanFile);
      form.set('bucket', 'member_applications');
      form.set('path', path);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');

      const docRow: any = {
        member_id: editingAdmin.id,
        kind: 'application_scan',
        bucket: String(json.bucket || 'member_applications'),
        path: String(json.path || path),
        original_name: scanFile.name,
        mime: scanFile.type || null,
        size_bytes: typeof scanFile.size === 'number' ? scanFile.size : null,
        uploaded_by: userId,
        updated_at: new Date().toISOString(),
      };

      const { data: up, error } = await supabase.from('member_documents').upsert([docRow], { onConflict: 'member_id,kind' }).select('*').maybeSingle();
      if (error) throw error;
      setScanDoc(up || docRow);
      setScanFile(null);
      showToast('Sken uložen', 'success');
    } finally {
      setScanBusy(false);
    }
  };

  const openScan = async () => {
    if (!scanDoc?.bucket || !scanDoc?.path) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Unauthorized');
    const res = await fetch('/api/admin/storage/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bucket: scanDoc.bucket, path: scanDoc.path, expiresIn: 300 }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Chyba');
    const url = String(json?.signedUrl || '');
    if (!url) throw new Error('Chybí URL');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEdit = async (adm: any) => {
    let full = adm;
    try {
      if (adm?.id && adm?.can_view_events === undefined) {
        const res = await supabase.from('profiles').select('*').eq('id', adm.id).single();
        if (res.error) throw res.error;
        full = res.data;
      }
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
      return;
    }

    setEditingAdmin(full);
    const resetData: any = {
      email: full.email,
      first_name: full.first_name || '',
      last_name: full.last_name || '',
      is_admin: full.is_admin || false,
      is_member: full.is_member || false,
      member_since: full.member_since || '',
      application_scan_url: full.application_scan_url || '',
      phone: '',
      address: '',
      date_of_birth: '',
      application_received_at: '',
      notes_internal: '',
      can_manage_admins: full.can_manage_admins || false,
    };
    
    modules.forEach(m => {
      resetData[`can_view_${m.id}`] = full[`can_view_${m.id}`] || false;
      resetData[`can_edit_${m.id}`] = full[`can_edit_${m.id}`] || false;
    });

    reset(resetData);

    try {
      const ap = await supabase.from('member_admin_profile').select('*').eq('member_id', full.id).maybeSingle();
      if (ap.data) {
        const toLocalDateTime = (iso: string) => {
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return '';
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setValue('phone', ap.data.phone || '', { shouldDirty: false });
        setValue('address', ap.data.address || '', { shouldDirty: false });
        setValue('date_of_birth', ap.data.date_of_birth || '', { shouldDirty: false });
        setValue('application_received_at', ap.data.application_received_at ? toLocalDateTime(ap.data.application_received_at) : '', { shouldDirty: false });
        setValue('notes_internal', ap.data.notes_internal || '', { shouldDirty: false });
      }

      const doc = await supabase
        .from('member_documents')
        .select('*')
        .eq('member_id', full.id)
        .eq('kind', 'application_scan')
        .maybeSingle();
      setScanDoc(doc.data || null);
      setScanFile(null);
    } catch {
      setScanDoc(null);
      setScanFile(null);
    }
  };

  const handleCancel = () => {
    setEditingAdmin(null);
    setScanDoc(null);
    setScanFile(null);
    reset();
  };

  const deleteAdmin = (id: string) => {
    setModalConfig({
      title: dict.admin.confirmDeleteAdmin || 'Smazat administrátora?',
      message: dict.admin.confirmDeleteAdminMessage || 'Opravdu chcete tohoto administrátora smazat? Tato operace je nevratná a uživatel ztratí přístup do admin panelu.',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={dict.admin.tabUsers || 'Uživatelé a správa'}
        description="Správa administrátorů, členů a jejich oprávnění"
        actions={
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl border border-stone-100">
            <ShieldCheck size={16} className="text-green-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
              {admins.length + members.length}{adminsQuery.hasNextPage || membersQuery.hasNextPage ? '+' : ''} uživatelů
            </span>
          </div>
        }
      />

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* FORM SECTION */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-in slide-in-from-left duration-500 sticky top-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-stone-900 flex items-center gap-3">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                {editingAdmin ? <Edit3 size={20} /> : <UserPlus size={20} />} 
              </div>
              {editingAdmin ? dict.admin.editUser : dict.admin.addUser}
            </h2>
            {editingAdmin && (
              <button onClick={handleCancel} className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400">
                <X size={20} />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelFirstName || 'Jméno'}</label>
                <input {...register('first_name')} type="text" className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.first_name ? 'ring-red-500' : ''}`} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelLastName || 'Příjmení'}</label>
                <input {...register('last_name')} type="text" className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.last_name ? 'ring-red-500' : ''}`} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.email}</label>
              <input {...register('email')} type="email" className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.email ? 'ring-red-500' : ''}`} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelPassword || 'Heslo'}</label>
              <input {...register('password')} type="password" placeholder="••••••••" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
              <p className="text-[9px] text-stone-400 italic px-1">{editingAdmin ? 'Nechte prázdné pro zachování stávajícího hesla.' : 'Nechte prázdné pro automatické vygenerování.'}</p>
              {editingAdmin && (
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <button
                    type="button"
                    disabled={sendingReset}
                    onClick={() => sendResetLink(String(editingAdmin?.email || ''))}
                    className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
                  >
                    {sendingReset ? 'Odesílám...' : 'Poslat reset odkaz'}
                  </button>
                  <button
                    type="button"
                    disabled={sendingPassword || !passwordValue}
                    onClick={sendNewPasswordNow}
                    className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition disabled:opacity-50"
                  >
                    {sendingPassword ? 'Odesílám...' : 'Poslat nové heslo'}
                  </button>
                </div>
              )}
            </div>

            {editingAdmin && (
              <div className="pt-6 border-t border-stone-100 space-y-6">
                <div className="flex items-center gap-3 text-stone-900">
                  <FileText size={20} className="text-green-600" />
                  <h3 className="text-sm font-black uppercase tracking-widest">Přihláška (scan) + doplnění</h3>
                </div>

                <div className="space-y-3">
                  <div className="border-2 border-dashed border-stone-200 rounded-[2rem] p-6 text-center relative hover:border-green-400 hover:bg-green-50/30 transition-all">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setScanFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="text-stone-600 font-bold">
                      {scanFile ? scanFile.name : 'Klikni pro výběr PDF/JPG/PNG'}
                    </div>
                    <div className="text-[10px] text-stone-400 font-medium mt-1">Soubor se uloží jen pro superadminy</div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!scanFile || scanBusy}
                      onClick={async () => {
                        try {
                          await uploadScan();
                        } catch (e: any) {
                          showToast(e?.message || 'Chyba', 'error');
                        }
                      }}
                      className="bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition disabled:opacity-50"
                    >
                      {scanBusy ? 'Nahrávám...' : 'Nahrát scan'}
                    </button>
                    <button
                      type="button"
                      disabled={!scanDoc || scanBusy}
                      onClick={async () => {
                        try {
                          await openScan();
                        } catch (e: any) {
                          showToast(e?.message || 'Chyba', 'error');
                        }
                      }}
                      className="bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={16} /> Otevřít
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Telefon</label>
                    <input {...register('phone')} type="text" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Datum narození</label>
                    <input {...register('date_of_birth')} type="date" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Adresa</label>
                    <input {...register('address')} type="text" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Přihláška doručena</label>
                    <input {...register('application_received_at')} type="datetime-local" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Interní poznámka</label>
                    <input {...register('notes_internal')} type="text" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                  </div>
                </div>
              </div>
            )}
            
            <div className="pt-6 border-t border-stone-100 space-y-6">
              <div className="flex items-center gap-3 text-stone-900">
                <ShieldCheck size={20} className="text-green-600" /> 
                <h3 className="text-sm font-black uppercase tracking-widest">{dict.admin.permissions}</h3>
              </div>
              
              <div className="bg-stone-50/50 rounded-[2rem] border border-stone-100 overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-100/50 text-[9px] font-black uppercase tracking-widest text-stone-400 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-3">{dict.admin.module || 'Modul'}</th>
                        <th className="px-2 py-3 text-center">Zobrazit</th>
                        <th className="px-2 py-3 text-center">Upravit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {modules.map((mod): ReactNode => (
                        <tr key={mod.id} className="hover:bg-white transition-colors group">
                          <td className="px-6 py-3 font-bold text-stone-600 group-hover:text-stone-900">{mod.label}</td>
                          <td className="px-2 py-3 text-center">
                            <input 
                              type="checkbox" 
                              {...register(`can_view_${mod.id}` as any)} 
                              onChange={(e) => {
                                const val = e.target.checked;
                                setValue(`can_view_${mod.id}` as any, val, { shouldDirty: true });
                                if (!val) setValue(`can_edit_${mod.id}` as any, false, { shouldDirty: true });
                              }}
                              className="w-4 h-4 accent-green-600 rounded-lg cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-3 text-center">
                            <input 
                              type="checkbox" 
                              {...register(`can_edit_${mod.id}` as any)} 
                              onChange={(e) => {
                                const val = e.target.checked;
                                setValue(`can_edit_${mod.id}` as any, val, { shouldDirty: true });
                                if (val) setValue(`can_view_${mod.id}` as any, true, { shouldDirty: true });
                              }}
                              className="w-4 h-4 accent-green-600 rounded-lg cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-stone-900 text-white p-6 rounded-[2rem] space-y-4 shadow-xl">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{dict.admin.globalRoles || 'Globální Role'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" {...register('is_admin')} className="w-5 h-5 rounded-lg border-stone-700 bg-stone-800 text-green-500 focus:ring-green-500" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-200 group-hover:text-white transition">{dict.admin.roleAdmin || 'Administrátor'}</span>
                      <span className="text-[10px] text-stone-500 font-medium">{dict.admin.roleAdminDesc}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" {...register('is_member')} className="w-5 h-5 rounded-lg border-stone-700 bg-stone-800 text-blue-500 focus:ring-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-200 group-hover:text-white transition">{dict.admin.roleMember || 'Člen spolku'}</span>
                      <span className="text-[10px] text-stone-500 font-medium">{dict.admin.roleMemberDesc}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group pt-2 border-t border-stone-800">
                    <input type="checkbox" {...register('can_manage_admins')} className="w-5 h-5 rounded-lg border-stone-700 bg-stone-800 text-purple-500 focus:ring-purple-500" />
                    <span className="text-sm font-bold text-stone-200 group-hover:text-white transition">{dict.admin.superAdmin || 'SuperAdmin'}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {editingAdmin && (
                <button type="button" onClick={handleCancel} className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-200 transition-all">
                  {dict.admin.btnCancel}
                </button>
              )}
              <button type="submit" disabled={saveMutation.isPending} className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 shadow-lg shadow-green-900/20 transition-all disabled:opacity-50">
                {saveMutation.isPending ? (dict.admin.btnSaving || 'Ukládám...') : (dict.admin.btnSaveUser || 'Uložit uživatele')}
              </button>
            </div>
          </form>
        </div>

        {/* LIST SECTION */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
          <div className="mb-10 p-6 rounded-[2rem] bg-stone-50 border border-stone-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Hromadné přidání</div>
                <div className="text-lg font-black text-stone-900">Vlož e-maily a systém pošle náhodná hesla</div>
                <div className="text-xs text-stone-500 font-medium mt-1">
                  Formát: <span className="font-black">email</span> nebo <span className="font-black">email;Jméno;Příjmení;role</span> (role: admin/member).
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkDefaultRole('member')}
                  className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${bulkDefaultRole === 'member' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                >
                  Default: člen
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDefaultRole('admin')}
                  className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${bulkDefaultRole === 'admin' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                >
                  Default: admin
                </button>
              </div>
            </div>

            <div className="mt-5 grid md:grid-cols-12 gap-4 items-start">
              <div className="md:col-span-9">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"email@domena.cz\nemail2@domena.cz;Jméno;Příjmení;member\nemail3@domena.cz;;;admin"}
                  className="w-full min-h-[140px] bg-white rounded-[1.5rem] border border-stone-200 p-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div className="md:col-span-3 space-y-3">
                <div className="bg-white rounded-[1.5rem] border border-stone-200 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Nalezeno</div>
                  <div className="text-3xl font-black text-stone-900 mt-1">{parseBulkUsers(bulkText).length}</div>
                  <div className="text-[10px] text-stone-500 font-medium mt-1">platných řádků</div>
                </div>
                <button
                  type="button"
                  disabled={bulkMutation.isPending || parseBulkUsers(bulkText).length === 0}
                  onClick={() => bulkMutation.mutate({ users: parseBulkUsers(bulkText) })}
                  className="w-full bg-stone-900 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition disabled:opacity-50"
                >
                  {bulkMutation.isPending ? (dict.admin?.btnLoading || 'Načítám...') : 'Hromadně přidat'}
                </button>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-black text-stone-900 mb-8">Admini</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {adminsQuery.isLoading ? (
              <div className="sm:col-span-2 p-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs bg-stone-50 rounded-[2rem] border border-dashed border-stone-200">
                {dict.admin.btnLoading || 'Načítám...'}
              </div>
            ) : (
              admins.map((adm) => (
                <div key={adm.id} className="flex gap-4 items-center p-5 bg-stone-50/50 rounded-[2rem] border border-transparent hover:border-stone-100 hover:bg-white transition-all group">
                  <div className="w-14 h-14 bg-stone-900 text-white rounded-2xl flex items-center justify-center font-black text-lg uppercase shrink-0 shadow-lg shadow-stone-900/20 group-hover:bg-green-600 transition-colors">
                    {((adm.first_name?.[0] || '') as string)}{((adm.last_name?.[0] || '') as string)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-black text-stone-900 truncate">{adm.first_name} {adm.last_name}</h3>
                    <p className="text-xs text-stone-400 font-bold truncate mb-3">{adm.email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {adm.is_admin && <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Admin</span>}
                      {adm.is_member && <span className="text-[8px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Člen</span>}
                      {adm.can_manage_admins && <span className="text-[8px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">SuperAdmin</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(adm)} className="p-2 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                    {adm.email !== 'cepelak@pupen.org' && (
                      <button onClick={() => deleteAdmin(adm.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {adminsQuery.hasNextPage && (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => adminsQuery.fetchNextPage()}
                disabled={adminsQuery.isFetchingNextPage}
                className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                {adminsQuery.isFetchingNextPage ? (dict.admin.btnLoading || 'Načítám...') : (dict.admin.btnMore || 'Načíst další')}
              </button>
            </div>
          )}

          <div className="mt-10 pt-10 border-t border-stone-100">
            <h2 className="text-xl font-black text-stone-900 mb-8">Členové</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {membersQuery.isLoading ? (
                <div className="sm:col-span-2 p-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs bg-stone-50 rounded-[2rem] border border-dashed border-stone-200">
                  {dict.admin.btnLoading || 'Načítám...'}
                </div>
              ) : (
                members.map((adm) => (
                  <div key={adm.id} className="flex gap-4 items-center p-5 bg-stone-50/50 rounded-[2rem] border border-transparent hover:border-stone-100 hover:bg-white transition-all group">
                    <div className="w-14 h-14 bg-stone-900 text-white rounded-2xl flex items-center justify-center font-black text-lg uppercase shrink-0 shadow-lg shadow-stone-900/20 group-hover:bg-blue-600 transition-colors">
                      {((adm.first_name?.[0] || '') as string)}
                      {((adm.last_name?.[0] || '') as string)}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="font-black text-stone-900 truncate">
                        {adm.first_name} {adm.last_name}
                      </h3>
                      <p className="text-xs text-stone-400 font-bold truncate mb-3">{adm.email}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[8px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Člen</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(adm)} className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                        <Edit3 size={18} />
                      </button>
                      {adm.email !== 'cepelak@pupen.org' && (
                        <button onClick={() => deleteAdmin(adm.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {membersQuery.hasNextPage && (
              <div className="flex justify-center pt-6">
                <button
                  type="button"
                  onClick={() => membersQuery.fetchNextPage()}
                  disabled={membersQuery.isFetchingNextPage}
                  className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {membersQuery.isFetchingNextPage ? (dict.admin.btnLoading || 'Načítám...') : (dict.admin.btnMore || 'Načíst další')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
      />
    </div>
  );
}
