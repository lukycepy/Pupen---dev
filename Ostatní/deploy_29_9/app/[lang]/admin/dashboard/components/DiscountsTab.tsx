'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Trash2, MapPin, Loader2, Save, X, ShoppingBag, Edit3 } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function DiscountsTab({ dict, readOnly = false }: { dict: any, readOnly?: boolean }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', discount: '', category: '', location_name: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [editingDiscount, setEditingDiscount] = useState<any>(null);

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ['admin_discounts'],
    queryFn: async () => {
      const { data } = await supabase.from('isic_discounts').select('*').order('title');
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (editingDiscount) {
        const { error } = await supabase.from('isic_discounts').update(newData).eq('id', editingDiscount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('isic_discounts').insert([newData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_discounts'] });
      showToast(editingDiscount ? 'Sleva upravena' : 'Sleva přidána', 'success');
      setIsAdding(false);
      setEditingDiscount(null);
      setFormData({ title: '', discount: '', category: '', location_name: '' });
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const handleEdit = (discount: any) => {
    setEditingDiscount(discount);
    setFormData({
      title: discount.title,
      discount: discount.discount,
      category: discount.category || '',
      location_name: discount.location_name || ''
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setEditingDiscount(null);
    setIsAdding(false);
    setFormData({ title: '', discount: '', category: '', location_name: '' });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('isic_discounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_discounts'] });
      showToast('Sleva smazána', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat slevu?',
      message: 'Opravdu chcete tuto slevu trvale smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Tag className="text-green-600" />
          {dict.admin.tabDiscounts}
        </h2>
        {!readOnly && (
          <button 
            onClick={() => { if(isAdding) handleCancel(); else setIsAdding(true); }}
            className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
            {isAdding ? 'Zrušit' : 'Nová sleva'}
          </button>
        )}
      </div>

      {isAdding && !readOnly && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-xl font-bold mb-6">{editingDiscount ? 'Upravit slevu' : 'Nová sleva'}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název partnera / Prodejny</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Bageterie Boulevard"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Sleva</label>
              <input 
                type="text" 
                value={formData.discount}
                onChange={e => setFormData({...formData, discount: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. 15% na vše"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</label>
              <input 
                type="text" 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Jídlo / Zábava / Sport"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Lokalita</label>
              <input 
                type="text" 
                value={formData.location_name}
                onChange={e => setFormData({...formData, location_name: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Suchdol, Dejvice"
              />
            </div>
            <div className="md:col-span-2">
              <button 
                onClick={() => saveMutation.mutate(formData)}
                disabled={!formData.title || !formData.discount || saveMutation.isPending}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editingDiscount ? 'Aktualizovat slevu' : 'Uložit slevu'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {discounts.map((item: any) => (
          <div key={item.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded-md">{item.category}</span>
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-1">{item.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-stone-400 text-sm font-medium">
                  <span className="flex items-center gap-1.5 font-black text-green-600"><ShoppingBag size={14} /> {item.discount}</span>
                  <span className="flex items-center gap-1.5"><MapPin size={14} /> {item.location_name}</span>
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleEdit(item)}
                    className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-green-600 hover:text-white transition shadow-sm"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition shadow-sm"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              )}
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
