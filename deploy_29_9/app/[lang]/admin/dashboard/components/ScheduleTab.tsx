'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus, Trash2, Loader2, Save, X, Edit2 } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function ScheduleTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({ title: '', title_en: '', start_date: '', end_date: '', category: 'other' });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      title_en: item.title_en || '',
      start_date: item.start_date ? new Date(item.start_date).toISOString().split('T')[0] : '',
      end_date: item.end_date ? new Date(item.end_date).toISOString().split('T')[0] : '',
      category: item.category || 'other'
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormData({ title: '', title_en: '', start_date: '', end_date: '', category: 'other' });
  };

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['admin_schedule'],
    queryFn: async () => {
      const { data } = await supabase.from('academic_schedule').select('*').order('start_date', { ascending: true });
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (editingItem) {
        const { error } = await supabase.from('academic_schedule').update(newData).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('academic_schedule').insert([newData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_schedule'] });
      showToast(editingItem ? 'Termín upraven' : 'Termín přidán do harmonogramu', 'success');
      handleCancel();
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academic_schedule').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_schedule'] });
      showToast('Termín smazán', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat termín?',
      message: 'Opravdu chcete tento termín z harmonogramu smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Calendar className="text-green-600" />
          {dict.admin.tabSchedule}
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
          {isAdding ? 'Zrušit' : 'Přidat termín'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název události (CZ)</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Zkouškové období zimní semestr"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Event Title (EN)</label>
              <input 
                type="text" 
                value={formData.title_en}
                onChange={e => setFormData({...formData, title_en: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="e.g. Winter Semester Exam Period"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Začátek</label>
              <input 
                type="date" 
                value={formData.start_date}
                onChange={e => setFormData({...formData, start_date: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Konec (nepovinné)</label>
              <input 
                type="date" 
                value={formData.end_date}
                onChange={e => setFormData({...formData, end_date: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition appearance-none"
              >
                <option value="exam">Zkouškové</option>
                <option value="holiday">Prázdniny</option>
                <option value="event">Akce</option>
                <option value="deadline">Uzávěrka</option>
                <option value="other">Ostatní</option>
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => saveMutation.mutate(formData)}
                disabled={!formData.title || !formData.start_date}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
                {editingItem ? 'Aktualizovat termín' : 'Uložit termín'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-100">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Datum</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Událost</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Kategorie</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {schedule.map((item: any) => (
              <tr key={item.id} className="hover:bg-stone-50/50 transition">
                <td className="px-6 py-4 text-sm font-medium text-stone-500">
                  {new Date(item.start_date).toLocaleDateString()}
                  {item.end_date && ` - ${new Date(item.end_date).toLocaleDateString()}`}
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-stone-900">{item.title}</div>
                  {item.title_en && <div className="text-[10px] text-stone-400 italic">EN: {item.title_en}</div>}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                    item.category === 'exam' ? 'bg-red-50 text-red-600' :
                    item.category === 'holiday' ? 'bg-blue-50 text-blue-600' :
                    item.category === 'deadline' ? 'bg-amber-50 text-amber-600' :
                    'bg-stone-100 text-stone-400'
                  }`}>
                    {dict.schedule?.[item.category] || item.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleEdit(item)}
                      className="p-2 text-stone-300 hover:text-stone-900 transition"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-stone-300 hover:text-red-600 transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
