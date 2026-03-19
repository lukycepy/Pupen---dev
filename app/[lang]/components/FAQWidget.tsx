'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Skeleton from './Skeleton';

export default function FAQWidget({ lang }: { lang: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen || faqs.length > 0) return;
    let isMounted = true;
    const run = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('faqs')
        .select('*')
        .order('sort_order', { ascending: true });
      if (isMounted && data) setFaqs(data);
      if (isMounted) setIsLoading(false);
    };
    run();
    return () => { isMounted = false; };
  }, [faqs.length, isOpen]);

  // Hide FAQ widget in admin and member portal
  const isAppSection = pathname?.includes('/admin') || pathname?.includes('/clen');
  if (isAppSection) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 bg-white rounded-3xl border shadow-2xl w-[350px] max-h-[500px] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-6 bg-green-600 text-white flex items-center justify-between">
            <div>
              <h3 className="font-black uppercase tracking-widest text-xs">FAQ</h3>
              <p className="text-[10px] opacity-80">Časté dotazy studentů</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-stone-50">
            {isLoading ? (
              <div className="py-8 space-y-3">
                <Skeleton className="h-5 w-full rounded-xl" />
                <Skeleton className="h-5 w-11/12 rounded-xl" />
                <Skeleton className="h-5 w-10/12 rounded-xl" />
                <Skeleton className="h-5 w-9/12 rounded-xl" />
              </div>
            ) : faqs.length > 0 ? (
              faqs.map((faq) => (
                <div key={faq.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                  <button 
                    onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-stone-50 transition"
                  >
                    <span className="text-sm font-bold text-stone-700">
                      {lang === 'en' && faq.question_en ? faq.question_en : faq.question}
                    </span>
                    {expandedId === faq.id ? <ChevronUp size={16} className="text-green-600" /> : <ChevronDown size={16} className="text-stone-300" />}
                  </button>
                  {expandedId === faq.id && (
                    <div className="px-4 pb-4 text-xs text-stone-500 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                      {lang === 'en' && faq.answer_en ? faq.answer_en : faq.answer}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-stone-400 py-10">Zatím žádné dotazy.</p>
            )}
          </div>
          
          <div className="p-4 bg-white border-t text-center">
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-2">Nenašli jste odpověď?</p>
            <a href={`/${lang}/kontakt`} className="inline-block bg-stone-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition">
              Napište nám
            </a>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${isOpen ? 'bg-stone-900 text-white rotate-90 scale-90' : 'bg-green-600 text-white hover:scale-110 hover:rotate-12'}`}
      >
        {isOpen ? <X size={28} /> : <HelpCircle size={28} />}
      </button>
    </div>
  );
}
