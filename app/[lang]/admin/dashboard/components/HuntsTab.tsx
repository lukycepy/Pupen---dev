'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Map, Plus, Trash2, Edit2, Loader2, Save, X, ListTodo, HelpCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function HuntsTab({ dict, readOnly = false }: { dict: any, readOnly?: boolean }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ 
    title: '', 
    event_id: '', 
    is_active: true, 
    steps: [{ question: '', answer: '', hint: '' }] 
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [editingHunt, setEditingHunt] = useState<any>(null);

  const { data: events = [] } = useQuery({
    queryKey: ['admin_events_list'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('id, title').order('date', { ascending: false });
      return data || [];
    }
  });

  const { data: hunts = [], isLoading } = useQuery({
    queryKey: ['admin_hunts'],
    queryFn: async () => {
      const { data } = await supabase.from('scavenger_hunts').select('*, events(title)').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (readOnly) throw new Error('Pouze pro čtení');
      if (editingHunt) {
        const { error } = await supabase.from('scavenger_hunts').update(newData).eq('id', editingHunt.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('scavenger_hunts').insert([newData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_hunts'] });
      showToast(editingHunt ? 'Bojovka upravena' : 'Bojovka vytvořena', 'success');
      setIsAdding(false);
      setEditingHunt(null);
      setFormData({ title: '', event_id: '', is_active: true, steps: [{ question: '', answer: '', hint: '' }] });
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  const handleEdit = (hunt: any) => {
    if (readOnly) return;
    setEditingHunt(hunt);
    setFormData({
      title: hunt.title,
      event_id: hunt.event_id,
      is_active: hunt.is_active,
      steps: hunt.steps || [{ question: '', answer: '', hint: '' }]
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setEditingHunt(null);
    setIsAdding(false);
    setFormData({ title: '', event_id: '', is_active: true, steps: [{ question: '', answer: '', hint: '' }] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (readOnly) throw new Error('Pouze pro čtení');
      const { error } = await supabase.from('scavenger_hunts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_hunts'] });
      showToast('Bojovka smazána', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    if (readOnly) return;
    setModalConfig({
      title: 'Smazat bojovku?',
      message: 'Opravdu chcete tuto bojovku smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, { question: '', answer: '', hint: '' }]
    });
  };

  const updateStep = (index: number, field: string, value: string) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  const removeStep = (index: number) => {
    if (formData.steps.length === 1) return;
    const newSteps = formData.steps.filter((_, i) => i !== index);
    setFormData({ ...formData, steps: newSteps });
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Map className="text-green-600" />
          {dict.admin.tabHunts}
        </h2>
        {!readOnly && (
          <button 
            onClick={() => { if(isAdding) handleCancel(); else setIsAdding(true); }}
            className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
            {isAdding ? 'Zrušit' : 'Vytvořit bojovku'}
          </button>
        )}
      </div>

      {isAdding && !readOnly && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="space-y-6">
            <h2 className="text-xl font-bold">{editingHunt ? 'Upravit bojovku' : 'Nová bojovka'}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název bojovky</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="Např. Cesta za Pupenem"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Přiřazená akce</label>
                <select 
                  value={formData.event_id}
                  onChange={e => setFormData({...formData, event_id: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition appearance-none"
                >
                  <option value="">Vyberte akci...</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-8">
              <h3 className="text-lg font-bold flex items-center gap-2"><ListTodo className="text-green-600" /> Kroky bojovky</h3>
              {formData.steps.map((step, index) => (
                <div key={index} className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-4 relative">
                  <button 
                    onClick={() => removeStep(index)}
                    className="absolute top-4 right-4 text-stone-300 hover:text-red-600 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="grid gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Otázka / Úkol {index + 1}</label>
                      <input 
                        type="text" 
                        value={step.question}
                        onChange={e => updateStep(index, 'question', e.target.value)}
                        className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Správná odpověď</label>
                        <input 
                          type="text" 
                          value={step.answer}
                          onChange={e => updateStep(index, 'answer', e.target.value)}
                          className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Nápověda</label>
                        <input 
                          type="text" 
                          value={step.hint}
                          onChange={e => updateStep(index, 'hint', e.target.value)}
                          className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={addStep}
                className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 font-bold hover:border-green-300 hover:text-green-600 transition flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Přidat další krok
              </button>
            </div>

            <button 
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.title || !formData.event_id || formData.steps.some(s => !s.question || !s.answer) || saveMutation.isPending}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
              {editingHunt ? 'Aktualizovat bojovku' : 'Uložit bojovku'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {hunts.map((hunt: any) => (
          <div key={hunt.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-grow">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold text-stone-900">{hunt.title}</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    {hunt.events?.title || 'Neznámá akce'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-stone-400 text-[10px] font-black uppercase tracking-widest">
                  <span>{hunt.steps?.length || 0} úkolů</span>
                  <span>Nahrané: {new Date(hunt.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleEdit(hunt)}
                    className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-green-600 hover:text-white transition shadow-sm"
                  >
                    <Edit2 size={20} />
                  </button>
                  <button 
                    onClick={() => deleteItem(hunt.id)}
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
