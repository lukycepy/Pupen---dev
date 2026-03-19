'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Archive, Loader2, X, Edit2, Save } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';

export default function ArchiveTab({ dict, currentUser, readOnly = false }: { dict: any, currentUser?: any, readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', title_en: '', year: new Date().getFullYear(), description: '', description_en: '' });

  const [editingItem, setEditingItem] = useState<any>(null);

  const { data: archive = [], isLoading } = useQuery({
    queryKey: ['admin_archive'],
    queryFn: async () => {
      const { data } = await supabase.from('activity_archive').select('*').order('year', { ascending: false });
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        title: data.title,
        title_en: data.title_en || null,
        year: parseInt(data.year) || new Date().getFullYear(),
        description: data.description || null,
        description_en: data.description_en || null
      };

      if (editingItem) {
        const { error } = await supabase.from('activity_archive').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('activity_archive').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_archive'] });
      setIsAdding(false);
      setEditingItem(null);
      setFormData({ title: '', title_en: '', year: new Date().getFullYear(), description: '', description_en: '' });
      showToast(editingItem ? 'Záznam upraven' : (dict.archive?.saveSuccess || 'Záznam uložen'), 'success');
    },
    onError: (err: any) => {
      console.error('Archive save error:', err);
      showToast(err.message || 'Nepodařilo se uložit záznam.', 'error');
    }
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      title_en: item.title_en || '',
      year: item.year || new Date().getFullYear(),
      description: item.description || '',
      description_en: item.description_en || ''
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setEditingItem(null);
    setIsAdding(false);
    setFormData({ title: '', title_en: '', year: new Date().getFullYear(), description: '', description_en: '' });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activity_archive').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_archive'] });
      showToast(dict.admin.confirmDeleteSuccess, 'success');
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black flex items-center gap-3"><Archive className="text-green-600" /> {dict.admin.tabArchive}</h2>
        <button onClick={() => { if(isAdding) handleCancel(); else setIsAdding(true); }} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2">
          {isAdding ? <X size={18} /> : <Plus size={18} />} {isAdding ? dict.admin.btnCancel : dict.archive.newEntry}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
          <h2 className="text-xl font-bold">{editingItem ? 'Upravit záznam' : dict.archive.newEntry}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <input type="text" placeholder={dict.admin.labelTitle || 'Název'} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
            <input type="text" placeholder={dict.admin.labelTitleEn || 'Title (EN)'} value={formData.title_en} onChange={e => setFormData({...formData, title_en: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
            <input type="number" placeholder={dict.archive?.yearLabel || 'Rok'} value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value) || new Date().getFullYear()})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <textarea placeholder={dict.archive?.descriptionLabel || 'Popis (CZ)'} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold h-32" />
            <textarea placeholder={dict.archive?.descriptionLabelEn || 'Description (EN)'} value={formData.description_en} onChange={e => setFormData({...formData, description_en: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold h-32" />
          </div>
          <button 
            onClick={() => saveMutation.mutate(formData)}
            disabled={!formData.title || saveMutation.isPending}
            className="bg-green-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center gap-2"
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {editingItem ? dict.admin.btnUpdateArchive || 'Aktualizovat' : dict.admin.btnSaveArchive || 'Uložit do archivu'}
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {archive.map((item: any) => (
          <div key={item.id} className="bg-white p-6 rounded-2xl border shadow-sm flex justify-between items-center group">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black">{item.year}</span>
                <h3 className="font-bold text-stone-900">{item.title}</h3>
              </div>
              <p className="text-sm text-stone-500 line-clamp-1">{item.description}</p>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => handleEdit(item)} className="p-2 text-stone-300 hover:text-green-600 transition">
                <Edit2 size={18} />
              </button>
              <button onClick={() => deleteMutation.mutate(item.id)} className="p-2 text-stone-300 hover:text-red-500 transition">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
