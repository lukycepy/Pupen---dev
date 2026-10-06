'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2, Loader2, Save, X } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import dynamic from 'next/dynamic';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

const Editor = dynamic(() => import('../../../components/Editor'), { 
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />
});

export default function GuideTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', title_en: '', content: '', content_en: '', category: 'Obecné', order_index: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: guide = [], isLoading } = useQuery({
    queryKey: ['admin_guide'],
    queryFn: async () => {
      const { data } = await supabase.from('freshman_guide').select('*').order('order_index', { ascending: true });
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newData: any) => {
      const { error } = await supabase.from('freshman_guide').insert([newData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_guide'] });
      showToast('Sekce průvodce přidána', 'success');
      setIsAdding(false);
      setFormData({ title: '', title_en: '', content: '', content_en: '', category: 'Obecné', order_index: 0 });
     },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('freshman_guide').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_guide'] });
      showToast('Sekce smazána', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat sekci?',
      message: 'Opravdu chcete tuto sekci průvodce trvale smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <BookOpen className="text-green-600" />
          {dict.admin.tabGuide}
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
          {isAdding ? 'Zrušit' : 'Nová sekce'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název sekce (CZ)</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="Např. Jak se zorientovat v IS ČZU"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název sekce (EN)</label>
                <input 
                  type="text" 
                  value={formData.title_en}
                  onChange={e => setFormData({...formData, title_en: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="e.g. How to navigate IS CZU"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</label>
              <input 
                type="text" 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Studium / Koleje"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Pořadí</label>
              <input 
                type="number" 
                value={formData.order_index}
                onChange={e => setFormData({...formData, order_index: parseInt(e.target.value)})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Obsah sekce (CZ)</label>
              <Editor 
                value={formData.content}
                onChange={val => setFormData({...formData, content: val})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Obsah sekce (EN)</label>
              <Editor 
                value={formData.content_en}
                onChange={val => setFormData({...formData, content_en: val})}
              />
            </div>
          </div>

          <button 
            onClick={() => addMutation.mutate(formData)}
            disabled={!formData.title || addMutation.isPending}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
          >
            {addMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {dict.admin.btnSaveGuide}
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {guide.map((item: any) => (
          <div key={item.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-grow">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 bg-stone-50 px-2 py-0.5 rounded-md">Pořadí: {item.order_index}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded-md">{item.category}</span>
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-1">{item.title}</h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => deleteItem(item.id)}
                  className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition shadow-sm"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
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
