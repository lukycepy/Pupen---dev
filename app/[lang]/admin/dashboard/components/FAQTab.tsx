'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Edit3, HelpCircle, Loader2, X } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

const faqSchema = z.object({
  question: z.string().min(5, 'Otázka musí mít aspoň 5 znaků'),
  question_en: z.string().optional(),
  answer: z.string().min(10, 'Odpověď musí mít aspoň 10 znaků'),
  answer_en: z.string().optional(),
  sort_order: z.number(),
});

type FAQFormValues = z.infer<typeof faqSchema>;

export default function FAQTab({ dict, readOnly = false }: { dict: any, readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ['faqs'],
    queryFn: async () => {
      const { data } = await supabase.from('faqs').select('*').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FAQFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: '',
      answer: '',
      sort_order: 0,
      question_en: '',
      answer_en: ''
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanedData = {
        question: data.question,
        question_en: data.question_en?.trim() || null,
        answer: data.answer,
        answer_en: data.answer_en?.trim() || null,
        sort_order: data.sort_order || 0
      };

      if (editingFaq?.id) {
        const { error } = await supabase.from('faqs').update(cleanedData).eq('id', editingFaq.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('faqs').insert([cleanedData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
      handleCancel();
      showToast('FAQ uloženo', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('faqs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
      showToast('Smazáno', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat FAQ?',
      message: 'Opravdu chcete tuto otázku smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const handleEdit = (faq: any) => {
    setEditingFaq(faq);
    reset({
      question: faq.question,
      question_en: faq.question_en || '',
      answer: faq.answer,
      answer_en: faq.answer_en || '',
      sort_order: faq.sort_order
    });
  };

  const handleCancel = () => {
    setEditingFaq(null);
    reset();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">{dict.admin.tabFaq || 'Časté dotazy (FAQ)'}</h2>
          <p className="text-stone-400 text-xs font-medium mt-1">Správa otázek a odpovědí pro návštěvníky webu</p>
        </div>
        {!readOnly && !editingFaq && (
          <button 
            onClick={() => setEditingFaq({ id: null })} 
            className="bg-green-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
          >
            <Plus size={16} /> {dict.admin.newFaq || 'Přidat FAQ'}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* FORM SECTION */}
        {(editingFaq || !readOnly && faqs.length === 0) && (
          <div className="lg:col-span-5 xl:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-in slide-in-from-left duration-500 sticky top-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-stone-900 flex items-center gap-3">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  {editingFaq?.id ? <Edit3 size={20} /> : <Plus size={20} />} 
                </div>
                {editingFaq?.id ? dict.admin.editFaq : dict.admin.newFaq}
              </h2>
              <button onClick={handleCancel} className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelQuestion || 'Otázka'} (CZ)</label>
                  <input {...register('question')} placeholder="Zadejte otázku..." className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.question ? 'ring-red-500' : ''}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelQuestionEn || 'Question'} (EN)</label>
                  <input {...register('question_en')} placeholder="Enter question..." className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                </div>
              </div>

              <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelAnswer || 'Odpověď'} (CZ)</label>
                    <textarea {...register('answer')} rows={4} placeholder="Zadejte odpověď..." className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-medium text-stone-700 transition resize-none ${errors.answer ? 'ring-red-500' : ''}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelAnswerEn || 'Answer'} (EN)</label>
                    <textarea {...register('answer_en')} rows={4} placeholder="Enter answer..." className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-medium text-stone-700 transition resize-none" />
                  </div>
                </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelOrder || 'Pořadí zobrazení'}</label>
                <input {...register('sort_order', { valueAsNumber: true })} type="number" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
              </div>

              <div className="flex gap-3 pt-4">
                {editingFaq?.id && (
                  <button type="button" onClick={handleCancel} className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-200 transition-all">
                    {dict.admin.btnCancel}
                  </button>
                )}
                <button 
                  type="submit" 
                  disabled={saveMutation.isPending} 
                  className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <HelpCircle size={16} />}
                  {editingFaq?.id ? dict.admin.btnUpdateFaq || 'Aktualizovat' : dict.admin.btnSaveFaq || 'Uložit FAQ'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LIST SECTION */}
        <div className={`${editingFaq ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden`}>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-stone-900">{dict.admin.listFaq || 'Seznam FAQ'}</h2>
            {readOnly && <span className="px-3 py-1 bg-stone-50 text-stone-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-stone-100">{dict.admin.readOnly}</span>}
          </div>

          {isLoading ? (
            <SkeletonTabContent />
          ) : (
            <div className="space-y-4">
              {faqs.map((faq: any) => (
                <div key={faq.id} className="p-6 bg-stone-50/50 rounded-[2rem] border border-transparent hover:border-stone-100 hover:bg-white transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-stone-300 group-hover:text-green-600 shadow-sm transition-colors shrink-0">
                      <HelpCircle size={20} />
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="font-black text-stone-900 mb-1">{faq.question}</h3>
                      <p className="text-stone-500 text-sm font-medium line-clamp-2 leading-relaxed">{faq.answer}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-0.5 rounded">Pořadí: {faq.sort_order}</span>
                        {faq.question_en && <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-0.5 rounded">Lokalizováno (EN)</span>}
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(faq)} className="p-2 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                        <button onClick={() => deleteItem(faq.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {faqs.length === 0 && (
                <div className="py-20 text-center text-stone-400 bg-stone-50/50 rounded-[3rem] border border-dashed border-stone-100">
                  <HelpCircle size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="font-bold text-sm uppercase tracking-widest">Žádné FAQ k zobrazení</p>
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
