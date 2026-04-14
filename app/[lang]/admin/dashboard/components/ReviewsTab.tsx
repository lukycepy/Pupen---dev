'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Check, X, Trash2, BookOpen, User, Clock, Search } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function ReviewsTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin_subject_reviews'],
    queryFn: async () => {
      const { data } = await supabase.from('subject_reviews').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('subject_reviews').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_subject_reviews'] });
      showToast(dict.admin.alertStatusUpdated || 'Stav recenze aktualizován', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subject_reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_subject_reviews'] });
      showToast('Recenze smazána', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat recenzi?',
      message: 'Opravdu chcete tuto recenzi trvale smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const filteredReviews = reviews.filter(r => 
    r.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.comment.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <BookOpen className="text-green-600" />
          {dict.admin.tabReviews}
        </h2>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Hledat předmět..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-3 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 transition w-full md:w-64 font-medium"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredReviews.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Žádné recenze k zobrazení</p>
          </div>
        ) : (
          filteredReviews.map((review: any) => (
            <div key={review.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    {review.status !== 'published' && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                        Stav: {review.status}
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1">
                      <Clock size={10} /> {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-stone-900 mb-1">{review.subject_name}</h3>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'} />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                      Náročnost: {review.difficulty}/5
                    </span>
                    <span className="flex items-center gap-1.5 text-stone-400 text-sm font-medium">
                      <User size={14} /> {review.author_name}
                    </span>
                  </div>

                  <div className="text-stone-600 text-sm bg-stone-50 p-4 rounded-xl italic">
                    "{review.comment}"
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {review.status !== 'published' ? (
                    <button 
                      onClick={() => approveMutation.mutate({ id: review.id, status: 'published' })}
                      className="p-4 bg-green-50 text-green-600 rounded-2xl hover:bg-green-600 hover:text-white transition shadow-sm"
                    >
                      <Check size={20} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => approveMutation.mutate({ id: review.id, status: 'pending' })}
                      className="p-4 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-600 hover:text-white transition shadow-sm"
                    >
                      <X size={20} />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteItem(review.id)}
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
