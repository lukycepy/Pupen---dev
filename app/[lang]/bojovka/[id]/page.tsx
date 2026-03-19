'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Map, HelpCircle, ArrowRight, Trophy, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import Skeleton from '../../components/Skeleton';

export default function BojovkaPage() {
  const params = useParams();
  const id = params?.id as string;
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const { data: hunt, isLoading } = useQuery({
    queryKey: ['public_hunt', id],
    queryFn: async () => {
      const { data } = await supabase.from('scavenger_hunts').select('*').eq('id', id).single();
      return data;
    }
  });

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hunt) return;

    const step = hunt.steps[currentStep];
    if (answer.toLowerCase().trim() === step.answer.toLowerCase().trim()) {
      showToast('Správně! Pokračuj na další bod.', 'success');
      setAnswer('');
      setShowHint(false);
      
      if (currentStep + 1 < hunt.steps.length) {
        setCurrentStep(currentStep + 1);
      } else {
        setIsFinished(true);
      }
    } else {
      showToast('To není ono, zkus to znovu.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-900 text-white pt-24 pb-32">
        <div className="max-w-3xl mx-auto px-6">
          <header className="text-center mb-16">
            <div className="inline-flex p-3 bg-green-600 text-white rounded-2xl mb-6 shadow-xl shadow-green-900/50">
              <Map size={32} />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-12 w-72 mx-auto rounded-2xl bg-white/10" />
              <Skeleton className="h-6 w-80 mx-auto rounded-xl bg-white/10" />
            </div>
          </header>
          <div className="bg-stone-800 p-8 md:p-16 rounded-[4rem] shadow-2xl border border-white/5 space-y-10">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-40 rounded-lg bg-white/10" />
              <Skeleton className="h-2 w-32 rounded-full bg-white/10" />
            </div>
            <Skeleton className="h-10 w-4/5 rounded-2xl bg-white/10" />
            <div className="space-y-6">
              <Skeleton className="h-16 w-full rounded-[2rem] bg-white/10" />
              <div className="grid md:grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full rounded-[2rem] bg-white/10" />
                <Skeleton className="h-16 w-full rounded-[2rem] bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!hunt) return <div className="min-h-screen flex items-center justify-center text-stone-400 font-bold">Bojovka nenalezena.</div>;

  return (
    <div className="min-h-screen bg-stone-900 text-white pt-24 pb-32">
      <div className="max-w-3xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-600 text-white rounded-2xl mb-6 shadow-xl shadow-green-900/50">
            <Map size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">{hunt.title}</h1>
          <p className="text-stone-400 text-lg font-medium">Digitální bojovka po areálu ČZU</p>
        </header>

        {isFinished ? (
          <div className="bg-white text-stone-900 p-12 md:p-20 rounded-[4rem] shadow-2xl text-center relative overflow-hidden animate-in zoom-in duration-500">
            <Trophy className="mx-auto text-green-600 mb-8" size={80} />
            <h2 className="text-4xl md:text-6xl font-black mb-6">Gratulujeme!</h2>
            <p className="text-xl font-bold text-stone-500 mb-12">
              Dokončil jsi bojovku a vyřešil všechny úkoly. Doufáme, že tě cesta bavila!
            </p>
            <div className="p-6 bg-green-50 rounded-3xl border-2 border-green-100 mb-12">
              <p className="text-green-700 font-black uppercase tracking-widest text-sm mb-2">Tvá odměna</p>
              <p className="text-stone-900 font-bold">Ukaž tuto obrazovku na stánku Pupenu a získej drink zdarma!</p>
            </div>
            <button 
              onClick={() => window.location.href = `/${lang}`}
              className="bg-stone-900 text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-600 transition shadow-xl"
            >
              Zpět na hlavní web
            </button>
          </div>
        ) : (
          <div className="bg-stone-800 p-8 md:p-16 rounded-[4rem] shadow-2xl border border-white/5">
            <div className="flex items-center justify-between mb-12">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">Úkol {currentStep + 1} z {hunt.steps.length}</span>
              <div className="h-2 w-32 bg-stone-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" 
                  style={{ width: `${((currentStep + 1) / hunt.steps.length) * 100}%` }}
                />
              </div>
            </div>

            <h2 className="text-2xl md:text-4xl font-black mb-12 leading-tight">
              {hunt.steps[currentStep].question}
            </h2>

            <form onSubmit={handleCheck} className="space-y-6">
              <input 
                type="text" 
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                className="w-full bg-stone-900/50 border-2 border-stone-700 rounded-[2rem] px-8 py-6 font-bold text-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-center"
                placeholder="Tvoje odpověď..."
                autoFocus
              />
              
              <div className="grid md:grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center justify-center gap-2 py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm bg-stone-700 hover:bg-stone-600 transition"
                >
                  <HelpCircle size={18} /> {showHint ? 'Skrýt nápovědu' : 'Potřebuji nápovědu'}
                </button>
                <button 
                  type="submit"
                  disabled={!answer}
                  className="flex items-center justify-center gap-2 py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm bg-green-600 hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20"
                >
                  Odeslat <ArrowRight size={18} />
                </button>
              </div>
            </form>

            {showHint && (
              <div className="mt-8 p-6 bg-amber-900/20 border border-amber-900/30 rounded-3xl animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-2 text-amber-500 font-black uppercase tracking-widest text-[10px] mb-2">
                  <AlertTriangle size={14} /> Nápověda
                </div>
                <p className="text-amber-100 font-medium italic">{hunt.steps[currentStep].hint}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
