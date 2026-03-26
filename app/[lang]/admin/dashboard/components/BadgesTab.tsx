'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Plus, Edit2, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import AdminPanel from './ui/AdminPanel';
import { useToast } from '../../../../context/ToastContext';
import Image from 'next/image';

export default function BadgesTab({ dict, uploadImage }: { dict: any, uploadImage: (file: File, bucket: string) => Promise<string> }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  
  const [isEditing, setIsEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', icon: '', criteria: '', points: 0 });
  const [isUploading, setIsUploading] = useState(false);

  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['badges'],
    queryFn: async () => {
      const res = await fetch('/api/admin/badges');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.badges || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/admin/badges/${data.id}` : '/api/admin/badges';
      const method = data.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      setIsEditing(null);
      showToast('Uloženo', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/badges/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
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
      setFormData(prev => ({ ...prev, icon: url }));
      showToast('Obrázek nahrán', 'success');
    } catch (err: any) {
      showToast(err.message || 'Chyba nahrávání', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title="Odznaky (Gamifikace)"
        description="Správa členských odznaků a ocenění"
        actions={
          <button
            onClick={() => {
              setFormData({ name: '', description: '', icon: '', criteria: '', points: 0 });
              setIsEditing('new');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition"
          >
            <Plus size={16} /> Přidat Odznak
          </button>
        }
      />

      {isEditing && (
        <AdminPanel className="p-8 border-amber-500 ring-4 ring-amber-50 animate-in zoom-in-95 duration-300">
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(isEditing === 'new' ? formData : { ...formData, id: isEditing.id }); }} className="space-y-6">
            <h3 className="text-xl font-black text-stone-900 mb-6">{isEditing === 'new' ? 'Nový odznak' : 'Úprava odznaku'}</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Název odznaku</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Hodnota v bodech</label>
                <input
                  type="number"
                  value={formData.points}
                  onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Popis</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Kritéria pro získání</label>
              <textarea
                value={formData.criteria}
                onChange={e => setFormData({ ...formData, criteria: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Ikona (Obrázek)</label>
              <div className="flex gap-4 items-center">
                {formData.icon ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                    <Image src={formData.icon} alt="Icon" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400">
                    <ImageIcon size={24} />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 text-sm mb-2"
                    placeholder="URL ikony nebo nahrajte soubor..."
                  />
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-700 cursor-pointer hover:bg-stone-50 transition">
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    Nahrát z počítače
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-stone-100">
              <button type="button" onClick={() => setIsEditing(null)} className="px-6 py-3 rounded-xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition">
                Zrušit
              </button>
              <button type="submit" disabled={saveMutation.isPending} className="px-6 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition flex items-center gap-2">
                {saveMutation.isPending && <Loader2 size={18} className="animate-spin" />} Uložit odznak
              </button>
            </div>
          </form>
        </AdminPanel>
      )}

      {!isEditing && badges.length === 0 ? (
        <AdminEmptyState
          icon={Award}
          title="Žádné odznaky"
          description="Zatím jste nevytvořili žádné odznaky. Začněte přidáním prvního."
        />
      ) : !isEditing && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {badges.map((badge: any) => (
            <AdminPanel key={badge.id} className="p-6 relative overflow-hidden group hover:shadow-lg transition">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => {
                  setFormData({ name: badge.name, description: badge.description || '', icon: badge.icon || '', criteria: badge.criteria || '', points: badge.points || 0 });
                  setIsEditing(badge);
                }} className="p-2 bg-white text-stone-600 rounded-lg hover:bg-stone-100 shadow-sm border border-stone-100">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => {
                  if (confirm('Opravdu smazat?')) deleteMutation.mutate(badge.id);
                }} className="p-2 bg-white text-red-600 rounded-lg hover:bg-red-50 shadow-sm border border-stone-100">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 relative overflow-hidden">
                  {badge.icon ? (
                    <Image src={badge.icon} alt={badge.name} fill className="object-cover" unoptimized />
                  ) : (
                    <Award size={32} className="text-amber-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-lg leading-tight">{badge.name}</h3>
                  <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-black uppercase tracking-widest">
                    <Award size={12} /> {badge.points} bodů
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {badge.description && (
                  <p className="text-sm text-stone-600">{badge.description}</p>
                )}
                {badge.criteria && (
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Kritéria</p>
                    <p className="text-xs font-bold text-stone-700">{badge.criteria}</p>
                  </div>
                )}
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </div>
  );
}
