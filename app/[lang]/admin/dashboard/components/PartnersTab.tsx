'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Edit3, Image as ImageIcon, Loader2, Link as LinkIcon, X, Save } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

const partnerSchema = z.object({
  name: z.string().min(2, 'Název musí mít aspoň 2 znaky'),
  link_url: z.string().url('Neplatná URL').optional().or(z.literal('')),
  sort_order: z.number().optional(),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

export default function PartnersTab({ dict, uploadImage }: { dict: any, uploadImage: (file: File, bucket: string) => Promise<string> }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editingPartner, setEditingPartner] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data } = await supabase.from('partners').select('*').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      sort_order: 0
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: PartnerFormValues) => {
      let logoUrl = editingPartner?.logo_url || null;
      if (imageFile) logoUrl = await uploadImage(imageFile, 'partners');
      
      const payload = { ...data, logo_url: logoUrl };

      if (editingPartner) {
        const { error } = await supabase.from('partners').update(payload).eq('id', editingPartner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('partners').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      handleCancel();
      showToast('Partner uložen', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      showToast('Smazáno', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat partnera?',
      message: 'Opravdu chcete tohoto partnera smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const handleEdit = (partner: any) => {
    setEditingPartner(partner);
    reset({
      name: partner.name,
      link_url: partner.link_url || '',
      sort_order: partner.sort_order
    });
  };

  const handleCancel = () => {
    setEditingPartner(null);
    setImageFile(null);
    reset();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">{dict.admin.tabPartners || 'Partneři'}</h2>
          <p className="text-stone-400 text-xs font-medium mt-1">Správa log a odkazů na partnerské organizace</p>
        </div>
        {!editingPartner && (
          <button 
            onClick={() => setEditingPartner({})} 
            className="bg-green-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
          >
            <Plus size={16} /> {dict.admin.newPartner || 'Přidat partnera'}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* FORM SECTION */}
        {(editingPartner || !isLoading && partners.length === 0) && (
          <div className="lg:col-span-5 xl:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-in slide-in-from-left duration-500 sticky top-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-stone-900 flex items-center gap-3">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  {editingPartner?.id ? <Edit3 size={20} /> : <Plus size={20} />} 
                </div>
                {editingPartner?.id ? dict.admin.editPartner : dict.admin.newPartner}
              </h2>
              <button onClick={handleCancel} className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.partnerName || 'Název partnera'}</label>
                <input {...register('name')} placeholder="Zadejte název..." className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.name ? 'ring-red-500' : ''}`} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelLink || 'Odkaz na web'}</label>
                <input {...register('link_url')} placeholder="https://..." className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelOrder || 'Pořadí'}</label>
                <input {...register('sort_order', { valueAsNumber: true })} type="number" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Logo partnera</label>
                <div className="border-2 border-dashed border-stone-200 rounded-[2rem] p-8 text-center cursor-pointer relative group hover:border-green-400 hover:bg-green-50/30 transition-all duration-300">
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="flex flex-col items-center text-stone-400 group-hover:text-green-600 transition-colors">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white group-hover:shadow-md transition-all">
                        <ImageIcon size={32} />
                      </div>
                      {imageFile ? (
                        <span className="font-bold text-sm text-green-600 break-all">{imageFile.name}</span>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-stone-600 mb-1">{dict.admin.clickUpload}</span>
                          <span className="text-[10px] font-medium">PNG, JPG nebo WEBP (max. 2MB)</span>
                        </>
                      )}
                    </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                {editingPartner?.id && (
                  <button type="button" onClick={handleCancel} className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-200 transition-all">
                    {dict.admin.btnCancel}
                  </button>
                )}
                <button 
                  disabled={saveMutation.isPending} 
                  className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {editingPartner?.id ? dict.admin.btnUpdatePartner || 'Aktualizovat' : dict.admin.btnSavePartner || 'Uložit partnera'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LIST SECTION */}
        <div className={`${editingPartner ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden`}>
          <h2 className="text-xl font-black text-stone-900 mb-8">{dict.admin.listPartners || 'Seznam partnerů'}</h2>
          
          {isLoading ? (
            <SkeletonTabContent />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {partners.map((p: any) => (
                <div key={p.id} className="p-6 bg-stone-50/50 rounded-[2rem] border border-transparent hover:border-stone-100 hover:bg-white transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 relative rounded-2xl overflow-hidden shrink-0 border border-stone-100 bg-white p-2 shadow-sm">
                      {p.logo_url ? (
                        <Image src={p.logo_url} alt="" fill className="object-contain p-2" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-200">
                          <ImageIcon size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="font-black text-stone-900 truncate">{p.name}</h3>
                      {p.link_url && (
                        <a href={p.link_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 font-bold flex items-center gap-1 mt-1 hover:underline">
                          <LinkIcon size={10} /> WEB PARTNERA
                        </a>
                      )}
                      <div className="mt-2 text-[8px] font-black uppercase tracking-widest text-stone-400">Pořadí: {p.sort_order}</div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(p)} className="p-2 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                      <button onClick={() => deleteItem(p.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              ))}
              
              {partners.length === 0 && (
                <div className="col-span-full py-20 text-center text-stone-400 bg-stone-50/50 rounded-[3rem] border border-dashed border-stone-100">
                  <ImageIcon size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="font-bold text-sm uppercase tracking-widest">Žádní partneři k zobrazení</p>
                </div>
              )}
            </div>
          )}
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
