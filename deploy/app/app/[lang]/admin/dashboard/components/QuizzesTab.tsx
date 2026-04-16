'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BrainCircuit, Plus, Trash2, Save, X, ListTodo } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function QuizzesTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', questions: [{ question: '', options: ['', '', '', ''], correct: 0 }] });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['admin_quizzes'],
    queryFn: async () => {
      const { data } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newData: any) => {
      const { error } = await supabase.from('quizzes').insert([newData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_quizzes'] });
      showToast('Kvíz vytvořen', 'success');
      setIsAdding(false);
      setFormData({ title: '', description: '', questions: [{ question: '', options: ['', '', '', ''], correct: 0 }] });
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quizzes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_quizzes'] });
      showToast('Kvíz smazán', 'success');
    }
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat kvíz?',
      message: 'Opravdu chcete tento kvíz trvale smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [...formData.questions, { question: '', options: ['', '', '', ''], correct: 0 }]
    });
  };

  const updateQuestion = (qIndex: number, field: string, value: any) => {
    const newQuestions = [...formData.questions];
    newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...formData.questions];
    newQuestions[qIndex].options[oIndex] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <BrainCircuit className="text-green-600" />
          {dict.admin.tabQuizzes}
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
          {isAdding ? 'Zrušit' : 'Vytvořit kvíz'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název kvízu</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Jak dobře znáš Suchdol?"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Popis</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition h-24"
                placeholder="Krátké intro ke kvízu..."
              />
            </div>

            <div className="space-y-8">
              <h3 className="text-lg font-bold flex items-center gap-2"><ListTodo className="text-green-600" /> Otázky</h3>
              {formData.questions.map((q, qIndex) => (
                <div key={qIndex} className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Otázka {qIndex + 1}</label>
                    <input 
                      type="text" 
                      value={q.question}
                      onChange={e => updateQuestion(qIndex, 'question', e.target.value)}
                      className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {q.options.map((opt, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          checked={q.correct === oIndex}
                          onChange={() => updateQuestion(qIndex, 'correct', oIndex)}
                          className="w-5 h-5 text-green-600 focus:ring-green-500 border-stone-300"
                        />
                        <input 
                          type="text" 
                          value={opt}
                          onChange={e => updateOption(qIndex, oIndex, e.target.value)}
                          className="flex-grow bg-white border-none rounded-xl px-4 py-2 text-sm font-medium text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                          placeholder={`Možnost ${oIndex + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button 
                onClick={addQuestion}
                className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 font-bold hover:border-green-300 hover:text-green-600 transition flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Přidat další otázku
              </button>
            </div>

            <button 
              onClick={() => addMutation.mutate(formData)}
              disabled={!formData.title || formData.questions.some(q => !q.question)}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
            >
              <Save size={18} /> Uložit kvíz
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {quizzes.map((quiz: any) => (
          <div key={quiz.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-grow">
                <h3 className="text-lg font-bold text-stone-900 mb-1">{quiz.title}</h3>
                <p className="text-stone-500 text-sm mb-2">{quiz.description}</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 bg-stone-50 px-3 py-1 rounded-full">
                  {quiz.questions?.length || 0} otázek
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => deleteItem(quiz.id)}
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
