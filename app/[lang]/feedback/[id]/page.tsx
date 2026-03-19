'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageSquare, Star, Send, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import Skeleton from '../../components/Skeleton';
import InlinePulse from '@/app/components/InlinePulse';

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();
  
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ['public_event_feedback', id],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      return data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (newData: any) => {
      const { error } = await supabase.from('event_feedback').insert([newData]);
      if (error) throw error;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      showToast(lang === 'cs' ? 'Díky za tvůj názor!' : 'Thanks for your feedback!', 'success');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ event_id: id, rating, comment });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 pt-24 pb-32">
        <div className="max-w-3xl mx-auto px-6">
          <header className="text-center mb-16">
            <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
              <MessageSquare size={32} />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-12 w-64 mx-auto rounded-2xl" />
              <Skeleton className="h-6 w-[520px] max-w-full mx-auto rounded-xl" />
            </div>
          </header>
          <div className="bg-white p-8 md:p-16 rounded-[4rem] shadow-2xl border border-stone-100 space-y-12">
            <div className="space-y-6">
              <Skeleton className="h-4 w-40 mx-auto rounded-lg" />
              <div className="flex justify-center gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-12 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-5 w-40 mx-auto rounded-xl" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-64 rounded-lg" />
              <Skeleton className="h-40 w-full rounded-[2rem]" />
            </div>
            <Skeleton className="h-16 w-full rounded-[2rem]" />
          </div>
        </div>
      </div>
    );
  }
  if (!event) return <div className="min-h-screen flex items-center justify-center text-stone-400 font-bold">Akce nenalezena.</div>;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-3xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">Zpětná vazba</h1>
          <p className="text-stone-500 text-lg font-medium">Jak se ti líbila akce <span className="text-green-600 font-bold">{event.title}</span>?</p>
        </header>

        {isSubmitted ? (
          <div className="bg-white p-12 md:p-20 rounded-[4rem] shadow-2xl text-center border border-green-100 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-8">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-stone-900 mb-6">Děkujeme!</h2>
            <p className="text-xl font-bold text-stone-500 mb-12"> Tvůj názor nám pomáhá dělat lepší akce pro studenty.</p>
            <button 
              onClick={() => router.push(`/${lang}`)}
              className="bg-stone-900 text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-600 transition shadow-xl"
            >
              Zpět na domovskou stránku
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-8 md:p-16 rounded-[4rem] shadow-2xl border border-stone-100">
            <div className="mb-12 text-center">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-6">Tvoje hodnocení</label>
              <div className="flex justify-center gap-2 md:gap-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star 
                      size={48} 
                      className={`${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-stone-100'} transition-colors duration-200`} 
                    />
                  </button>
                ))}
              </div>
              <p className="mt-4 font-bold text-stone-400">
                {rating === 5 ? 'Úžasné!' : rating === 4 ? 'Skvělé' : rating === 3 ? 'Dobré' : rating === 2 ? 'Nic moc' : 'Špatné'}
              </p>
            </div>

            <div className="mb-12">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 block mb-2">Co se ti líbilo / nelíbilo? (nepovinné)</label>
              <textarea 
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-[2rem] px-8 py-6 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition h-48"
                placeholder="Napiš nám pár slov..."
              />
            </div>

            <button 
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-green-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-xl shadow-green-900/20 flex items-center justify-center gap-3"
            >
              {mutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <Send size={20} />}
              Odeslat feedback
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
