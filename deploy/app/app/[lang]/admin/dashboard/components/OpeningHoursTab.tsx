'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Trash2, Save, X, Edit2 } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function OpeningHoursTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [formData, setFormData] = useState<any>({ 
    place_name: '', 
    place_name_en: '',
    hours_mon_fri: '', 
    hours_sat_sun: '', 
    note: '',
    note_en: '',
    daily_hours: [
      { day: 'Po', open: '', close: '', closed: false },
      { day: 'Út', open: '', close: '', closed: false },
      { day: 'St', open: '', close: '', closed: false },
      { day: 'Čt', open: '', close: '', closed: false },
      { day: 'Pá', open: '', close: '', closed: false },
      { day: 'So', open: '', close: '', closed: true },
      { day: 'Ne', open: '', close: '', closed: true },
    ]
  });

  const { data: hours = [], isLoading } = useQuery({
    queryKey: ['admin_opening_hours'],
    queryFn: async () => {
      const { data } = await supabase.from('opening_hours').select('*').order('place_name');
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newData: any) => {
      // Clean payload for DB
      const payload = {
        place_name: newData.place_name,
        place_name_en: newData.place_name_en || null,
        daily_hours: newData.daily_hours,
        note: newData.note || null,
        note_en: newData.note_en || null
      };

      if (editingItem) {
        const { error } = await supabase.from('opening_hours').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('opening_hours').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_opening_hours'] });
      showToast(editingItem ? (dict.admin?.alertUpdated || 'Upraveno') : (dict.admin?.alertAdded || 'Přidáno'), 'success');
      setIsAdding(false);
      setEditingItem(null);
      setFormData({ 
        place_name: '', 
        place_name_en: '',
        hours_mon_fri: '', 
        hours_sat_sun: '', 
        note: '',
        note_en: '',
        daily_hours: [
          { day: 'Po', open: '', close: '', closed: false },
          { day: 'Út', open: '', close: '', closed: false },
          { day: 'St', open: '', close: '', closed: false },
          { day: 'Čt', open: '', close: '', closed: false },
          { day: 'Pá', open: '', close: '', closed: false },
          { day: 'So', open: '', close: '', closed: true },
          { day: 'Ne', open: '', close: '', closed: true },
        ]
      });
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      place_name: item.place_name,
      place_name_en: item.place_name_en || '',
      hours_mon_fri: item.hours_mon_fri || '',
      hours_sat_sun: item.hours_sat_sun || '',
      note: item.note || '',
      note_en: item.note_en || '',
      daily_hours: item.daily_hours || [
        { day: 'Po', open: '', close: '', closed: false },
        { day: 'Út', open: '', close: '', closed: false },
        { day: 'St', open: '', close: '', closed: false },
        { day: 'Čt', open: '', close: '', closed: false },
        { day: 'Pá', open: '', close: '', closed: false },
        { day: 'So', open: '', close: '', closed: true },
        { day: 'Ne', open: '', close: '', closed: true },
      ]
    });
    setIsAdding(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('opening_hours').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_opening_hours'] });
      showToast('Smazáno', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat místo?',
      message: 'Opravdu chcete toto místo a jeho otevírací dobu smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3 mb-1">
            <Clock className="text-green-600" />
            {dict.admin?.tabHours || 'Otevírací doba'}
          </h2>
          <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Kdy mají otevřeno v knihovně, bufetu nebo na studijním oddělení?</p>
        </div>
        <button 
          onClick={() => {
            if (isAdding || editingItem) {
              setIsAdding(false);
              setEditingItem(null);
              setFormData({ 
                place_name: '', 
                place_name_en: '',
                hours_mon_fri: '', 
                hours_sat_sun: '', 
                note: '',
                note_en: '',
                daily_hours: [
                  { day: 'Po', open: '', close: '', closed: false },
                  { day: 'Út', open: '', close: '', closed: false },
                  { day: 'St', open: '', close: '', closed: false },
                  { day: 'Čt', open: '', close: '', closed: false },
                  { day: 'Pá', open: '', close: '', closed: false },
                  { day: 'So', open: '', close: '', closed: true },
                  { day: 'Ne', open: '', close: '', closed: true },
                ]
              });
            } else {
              setIsAdding(true);
            }
          }}
          className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-500 transition shadow-lg shadow-green-900/20 flex items-center gap-2"
        >
          {isAdding || editingItem ? <X size="16" /> : <Plus size="16" />}
          {isAdding || editingItem ? (dict.admin?.btnCancel || 'Zrušit') : (dict.admin?.addHoursPlace || 'Přidat místo')}
        </button>
      </div>

      {(isAdding || editingItem) && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.placeName || 'Název místa'} (CZ)</label>
              <input 
                type="text" 
                value={formData.place_name}
                onChange={e => setFormData({...formData, place_name: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Menza / Knihovna"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.placeName || 'Název místa'} (EN)</label>
              <input 
                type="text" 
                value={formData.place_name_en}
                onChange={e => setFormData({...formData, place_name_en: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="e.g. Canteen / Library"
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {formData.daily_hours.map((dayData: any, idx: number) => (
                <div key={dayData.day} className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 text-center">{dayData.day}</span>
                  <div className="flex flex-col gap-1">
                    <input 
                      type="text" 
                      placeholder={dict.admin?.hoursFrom || 'Od'}
                      disabled={dayData.closed}
                      value={dayData.open}
                      onChange={(e) => {
                        const newDays = [...formData.daily_hours];
                        newDays[idx].open = e.target.value;
                        setFormData({...formData, daily_hours: newDays});
                      }}
                      className="w-full text-[10px] font-bold p-1 rounded border-none bg-white text-center disabled:opacity-30"
                    />
                    <input 
                      type="text" 
                      placeholder={dict.admin?.hoursTo || 'Do'}
                      disabled={dayData.closed}
                      value={dayData.close}
                      onChange={(e) => {
                        const newDays = [...formData.daily_hours];
                        newDays[idx].close = e.target.value;
                        setFormData({...formData, daily_hours: newDays});
                      }}
                      className="w-full text-[10px] font-bold p-1 rounded border-none bg-white text-center disabled:opacity-30"
                    />
                  </div>
                  <label className="flex items-center justify-center gap-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={dayData.closed}
                      onChange={(e) => {
                        const newDays = [...formData.daily_hours];
                        newDays[idx].closed = e.target.checked;
                        setFormData({...formData, daily_hours: newDays});
                      }}
                      className="rounded text-green-600 focus:ring-green-500"
                    />
                    <span className="text-[8px] font-black uppercase tracking-widest text-stone-400">{dict.admin?.labelClosed || 'Zavřeno'}</span>
                  </label>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.labelNote || 'Poznámka'} (CZ)</label>
              <input 
                type="text" 
                value={formData.note}
                onChange={e => setFormData({...formData, note: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. O svátcích zavřeno"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin?.labelNote || 'Poznámka'} (EN)</label>
              <input 
                type="text" 
                value={formData.note_en}
                onChange={e => setFormData({...formData, note_en: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="e.g. Closed on holidays"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3">
              <button 
                onClick={() => { setIsAdding(false); setEditingItem(null); }}
                className="px-6 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-100 transition"
              >
                {dict.admin?.btnCancel || 'Zrušit'}
              </button>
              <button 
                onClick={() => addMutation.mutate(formData)}
                disabled={!formData.place_name}
                className="bg-green-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center gap-2"
              >
                <Save size={18} /> {editingItem ? (dict.admin?.btnUpdatePost || 'Upravit') : (dict.admin?.btnSaveHours || 'Uložit')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {hours.map((item: any) => (
          <div key={item.id} className="bg-white p-6 rounded-[2.5rem] border shadow-sm group hover:shadow-xl transition-all duration-300 hover:border-green-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-stone-900">{item.place_name}</h3>
                  {item.place_name_en && <span className="text-[10px] font-medium text-stone-400 border px-1.5 py-0.5 rounded italic">EN: {item.place_name_en}</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  {(item.daily_hours || []).map((day: any) => (
                    <div key={day.day} className="text-center p-2 rounded-xl bg-stone-50 border border-stone-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{day.day}</p>
                      <p className={`text-[11px] font-bold ${day.closed ? 'text-red-400' : 'text-stone-700'}`}>
                        {day.closed ? 'ZAVŘENO' : `${day.open} - ${day.close}`}
                      </p>
                    </div>
                  ))}
                </div>
                {item.note && (
                  <div className="flex flex-col gap-1 mt-3">
                    <p className="text-xs text-stone-400 font-medium flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg inline-flex">
                      <Clock size={12} className="text-stone-300" /> {item.note}
                    </p>
                    {item.note_en && (
                      <p className="text-xs text-stone-400 font-medium flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg inline-flex italic">
                        <span className="text-[10px] font-black uppercase">EN:</span> {item.note_en}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(item)} className="p-3 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition shadow-sm bg-white border">
                  <Edit2 size={20} />
                </button>
                <button onClick={() => deleteItem(item.id)} className="p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition shadow-sm bg-white border">
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
