'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Edit2, Trash2, Loader2, Image as ImageIcon, Mail, Phone, Linkedin, Twitter, Instagram } from 'lucide-react';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import AdminPanel from './ui/AdminPanel';
import { useToast } from '../../../../context/ToastContext';
import Image from 'next/image';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';

export default function BoardTab({ dict, uploadImage }: { dict: any, uploadImage: (file: File, bucket: string) => Promise<string> }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || null;
    if (!token) throw new Error('Unauthorized');
    return token;
  };
  
  const [isEditing, setIsEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: '', role: '', bio: '', image_url: '', 
    email: '', phone: '', social_linkedin: '', social_twitter: '', social_instagram: '',
    sort_order: 0, is_active: true 
  });
  const [isUploading, setIsUploading] = useState(false);

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/admin/team', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.team || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/admin/team/${data.id}` : '/api/admin/team';
      const method = data.id ? 'PUT' : 'POST';
      const token = await getToken();
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      setIsEditing(null);
      showToast('Člen týmu uložen', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      const res = await fetch(`/api/admin/team/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      showToast('Smazáno', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImage(file, 'images');
      setFormData(prev => ({ ...prev, image_url: url }));
      showToast('Fotka nahrána', 'success');
    } catch (err: any) {
      showToast(err.message || 'Chyba nahrávání', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const token = await getToken();
          const res = await fetch('/api/admin/team/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ rows: results.data })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          showToast(`Úspěšně importováno ${json.imported} členů`, 'success');
          queryClient.invalidateQueries({ queryKey: ['team_members'] });
        } catch (err: any) {
          showToast(err.message || 'Chyba importu', 'error');
        }
        e.target.value = '';
      }
    });
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title="Tým a Vedení"
        description="Správa členů týmu, karet a sociálních odkazů"
        actions={
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition cursor-pointer">
              Import CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
            </label>
            <button
              onClick={() => {
                setFormData({ 
                  name: '', role: '', bio: '', image_url: '', 
                  email: '', phone: '', social_linkedin: '', social_twitter: '', social_instagram: '',
                  sort_order: 0, is_active: true 
                });
                setIsEditing('new');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition"
            >
              <Plus size={16} /> Přidat člena
            </button>
          </div>
        }
      />

      {isEditing && (
        <AdminPanel className="p-8 border-green-500 ring-4 ring-green-50 animate-in zoom-in-95 duration-300">
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(isEditing === 'new' ? formData : { ...formData, id: isEditing.id }); }} className="space-y-6">
            <h3 className="text-xl font-black text-stone-900 mb-6">{isEditing === 'new' ? 'Nový člen týmu' : 'Úprava člena'}</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Jméno a příjmení</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Role / Pozice</label>
                <input
                  type="text"
                  required
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Krátký popis (Bio)</label>
              <textarea
                value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                rows={3}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 font-bold text-stone-700" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Telefon</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 font-bold text-stone-700" />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">LinkedIn URL</label>
                <div className="relative">
                  <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input type="url" value={formData.social_linkedin} onChange={e => setFormData({ ...formData, social_linkedin: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 font-bold text-stone-700 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Twitter URL</label>
                <div className="relative">
                  <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input type="url" value={formData.social_twitter} onChange={e => setFormData({ ...formData, social_twitter: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 font-bold text-stone-700 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Instagram URL</label>
                <div className="relative">
                  <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input type="url" value={formData.social_instagram} onChange={e => setFormData({ ...formData, social_instagram: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 font-bold text-stone-700 text-sm" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Fotka (Obrázek)</label>
              <div className="flex gap-4 items-center">
                {formData.image_url ? (
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                    <Image src={formData.image_url} alt="Icon" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                    <ImageIcon size={24} />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="text"
                    value={formData.image_url}
                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 text-sm mb-2"
                    placeholder="URL fotky nebo nahrajte soubor..."
                  />
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-700 cursor-pointer hover:bg-stone-50 transition">
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    Nahrát fotku
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="accent-green-600 w-5 h-5"
                />
                <span className="text-sm font-bold text-stone-700">Aktivní (zobrazit na webu)</span>
              </label>
              
              <div className="flex items-center gap-3 border-l border-stone-200 pl-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Pořadí</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-20 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 font-bold text-stone-700"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-stone-100">
              <button type="button" onClick={() => setIsEditing(null)} className="px-6 py-3 rounded-xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition">
                Zrušit
              </button>
              <button type="submit" disabled={saveMutation.isPending} className="px-6 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-600/20">
                {saveMutation.isPending && <Loader2 size={18} className="animate-spin" />} Uložit člena
              </button>
            </div>
          </form>
        </AdminPanel>
      )}

      {!isEditing && team.length === 0 ? (
        <AdminEmptyState
          icon={Users}
          title="Žádní členové týmu"
          description="Zatím jste nepřidali žádné členy týmu. Začněte přidáním prvního."
        />
      ) : !isEditing && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {team.map((member: any) => (
            <AdminPanel key={member.id} className={`p-0 overflow-hidden relative group hover:shadow-lg transition ${!member.is_active ? 'opacity-60 grayscale' : ''}`}>
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition z-10">
                <button onClick={() => {
                  setFormData(member);
                  setIsEditing(member);
                }} className="p-2 bg-white/90 backdrop-blur text-stone-600 rounded-lg hover:bg-white shadow-sm border border-stone-200">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => {
                  if (confirm('Opravdu smazat?')) deleteMutation.mutate(member.id);
                }} className="p-2 bg-white/90 backdrop-blur text-red-600 rounded-lg hover:bg-white shadow-sm border border-stone-200">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="aspect-square w-full bg-stone-100 relative">
                {member.image_url ? (
                  <Image src={member.image_url} alt={member.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                    <Users size={48} />
                  </div>
                )}
                {!member.is_active && (
                  <div className="absolute inset-0 bg-stone-900/50 flex items-center justify-center">
                    <span className="bg-stone-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Skryto</span>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-black text-stone-900 text-lg leading-tight truncate">{member.name}</h3>
                  <span className="text-[10px] font-black text-stone-400">#{member.sort_order}</span>
                </div>
                <p className="text-xs font-bold text-green-600 mb-3">{member.role}</p>
                
                {member.bio && (
                  <p className="text-xs text-stone-500 line-clamp-2 mb-4">{member.bio}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-stone-100">
                  {member.email && <a href={`mailto:${member.email}`} className="p-1.5 bg-stone-50 text-stone-400 hover:text-stone-700 rounded-lg transition"><Mail size={14} /></a>}
                  {member.social_linkedin && <a href={member.social_linkedin} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Linkedin size={14} /></a>}
                  {member.social_twitter && <a href={member.social_twitter} target="_blank" rel="noreferrer" className="p-1.5 bg-sky-50 text-sky-500 hover:bg-sky-100 rounded-lg transition"><Twitter size={14} /></a>}
                  {member.social_instagram && <a href={member.social_instagram} target="_blank" rel="noreferrer" className="p-1.5 bg-pink-50 text-pink-600 hover:bg-pink-100 rounded-lg transition"><Instagram size={14} /></a>}
                </div>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </div>
  );
}
