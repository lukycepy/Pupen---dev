'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Star, Trash2, Calendar, Copy, Check } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function FeedbackTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: events = [] } = useQuery({
    queryKey: ['admin_events_for_feedback'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('id, title').order('date', { ascending: false });
      return data || [];
    }
  });

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['admin_feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('event_feedback')
        .select('*, events(title)')
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_feedback').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_feedback'] });
      showToast('Feedback smazán', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat feedback?',
      message: 'Opravdu chcete tuto zpětnou vazbu smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (isLoading) return <SkeletonTabContent />;

  const feedbackUrl = selectedEventId ? `${window.location.origin}/cs/feedback/${selectedEventId}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(feedbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Odkaz zkopírován', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3 mb-1">
            <MessageSquare className="text-green-600" />
            {dict.admin.tabFeedback}
          </h2>
          <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Správa zpětné vazby od studentů</p>
        </div>

        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col md:flex-row items-center gap-4">
          <div className="text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">Generátor odkazu na feedback</span>
            <select 
              value={selectedEventId} 
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-white border-none rounded-lg text-sm font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition pr-8"
            >
              <option value="">Vyberte akci...</option>
              {events.map((ev: any) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>
          {selectedEventId && (
            <button 
              onClick={copyToClipboard}
              className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-green-600 transition shadow-lg"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              Kopírovat odkaz
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {feedback.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Zatím žádná zpětná vazba</p>
          </div>
        ) : (
          feedback.map((item: any) => (
            <div key={item.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1.5 bg-stone-50 px-3 py-1 rounded-full">
                      <Calendar size={12} /> {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full">
                      Akce: {item.events?.title || 'Neznámá akce'}
                    </span>
                  </div>
                  
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} className={i < item.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-100'} />
                    ))}
                  </div>
                  
                  <p className="text-stone-600 text-lg font-medium italic">
                    "{item.comment || 'Bez komentáře'}"
                  </p>
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
