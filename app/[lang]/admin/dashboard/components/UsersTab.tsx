'use client';

import React, { useState, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Edit3, Trash2, ShieldCheck, X } from 'lucide-react';
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

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<any>({
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

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // 1. Příprava payloadu pro tabulku 'profiles'
      const profilePayload: any = {
        first_name: data.first_name,
        last_name: data.last_name,
        is_admin: !!data.is_admin,
        is_member: !!data.is_member,
        member_since: data.member_since || null,
        application_scan_url: data.application_scan_url || null,
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

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
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
      can_manage_admins: full.can_manage_admins || false,
    };
    
    modules.forEach(m => {
      resetData[`can_view_${m.id}`] = full[`can_view_${m.id}`] || false;
      resetData[`can_edit_${m.id}`] = full[`can_edit_${m.id}`] || false;
    });

    reset(resetData);
  };

  const handleCancel = () => {
    setEditingAdmin(null);
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
              <p className="text-[9px] text-stone-400 italic px-1">Nechte prázdné pro automatické vygenerování.</p>
            </div>
            
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
