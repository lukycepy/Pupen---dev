'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Plus, Trash2, MapPin, Hash, Edit2, Loader2, Save, X } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function AssetsTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    name_en: '', 
    description: '', 
    description_en: '', 
    quantity: 1, 
    location: '',
    location_en: '' 
  });

  const handleEdit = (asset: any) => {
    setEditingItem(asset);
    setFormData({
      name: asset.name || '',
      name_en: asset.name_en || '',
      description: asset.description || '',
      description_en: asset.description_en || '',
      quantity: asset.quantity || 1,
      location: asset.location || '',
      location_en: asset.location_en || ''
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormData({ 
      name: '', 
      name_en: '', 
      description: '', 
      description_en: '', 
      quantity: 1, 
      location: '',
      location_en: '' 
    });
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['admin_assets'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('*').order('name');
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (editingItem) {
        const { error } = await supabase.from('assets').update(newData).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assets').insert([newData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_assets'] });
      showToast(editingItem ? (dict.admin?.assetUpdated || 'Položka upravena') : (dict.admin?.assetAdded || 'Položka přidána'), 'success');
      handleCancel();
    },
    onError: (err: any) => {
      console.error('Asset save error:', err);
      showToast(err.message || dict.admin?.assetSaveError || 'Nepodařilo se uložit položku.', 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_assets'] });
      showToast(dict.admin?.assetDeleted || 'Položka smazána', 'success');
      setModalOpen(false);
    }
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: dict.admin?.deleteAssetTitle || 'Smazat položku?',
      message: dict.admin?.deleteAssetConfirm || 'Opravdu chcete tuto položku z evidence majetku smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Box className="text-green-600" />
          {dict.admin?.tabAssets || 'Majetek'}
        </h2>
        <button 
          onClick={() => {
            if (isAdding || editingItem) handleCancel();
            else setIsAdding(true);
          }}
          className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
        >
          {isAdding || editingItem ? <X size={20} /> : <Plus size={20} />}
          {isAdding || editingItem ? (dict.admin?.btnCancel || 'Zrušit') : (dict.admin?.addAsset || 'Přidat majetek')}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.assetName || 'Název'} (CZ)</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Stan Pupen"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.assetName || 'Name'} (EN)</label>
              <input 
                type="text" 
                value={formData.name_en}
                onChange={e => setFormData({...formData, name_en: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="e.g. Pupen Tent"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.assetQuantity || 'Množství'}</label>
              <input 
                type="number" 
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.assetDescription || 'Popis'} (CZ)</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Stav, barva, příslušenství..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.assetDescription || 'Description'} (EN)</label>
              <input 
                type="text" 
                value={formData.description_en}
                onChange={e => setFormData({...formData, description_en: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Status, color, accessories..."
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.assetLocation || 'Umístění'} (CZ)</label>
              <input 
                type="text" 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Klubovna A341 / Sklad"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.assetLocation || 'Location'} (EN)</label>
              <input 
                type="text" 
                value={formData.location_en}
                onChange={e => setFormData({...formData, location_en: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Clubroom A341 / Storage"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => saveMutation.mutate(formData)}
                disabled={!formData.name || saveMutation.isPending}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editingItem ? (dict.admin?.btnUpdate || 'Aktualizovat položku') : (dict.admin?.btnSave || 'Uložit položku')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {assets.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Žádný majetek v evidenci</p>
          </div>
        ) : (
          assets.map((item: any) => (
            <div key={item.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-stone-900">{item.name}</h3>
                    {item.name_en && <span className="text-[10px] font-medium text-stone-400 border px-1.5 py-0.5 rounded italic">EN: {item.name_en}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-stone-400 text-sm font-medium">
                    <span className="flex items-center gap-1.5 bg-stone-50 px-3 py-1 rounded-full"><Hash size={14} /> {item.quantity}x</span>
                    <span className="flex items-center gap-1.5"><MapPin size={14} /> {item.location || 'Nespecifikováno'}</span>
                  </div>
                  {item.description && (
                    <p className="mt-3 text-stone-500 text-sm">{item.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleEdit(item)}
                    className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-900 hover:text-white transition shadow-sm"
                  >
                    <Edit2 size={20} />
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition shadow-sm"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
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
