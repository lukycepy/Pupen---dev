'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookOpen, Star, Plus, Search, MessageSquare, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import subjectsData from '@/lib/subjects_data.json';
import { getDictionary } from '@/lib/get-dictionary';
import Skeleton, { SkeletonList } from '../components/Skeleton';
import Popover from '@/app/components/ui/Popover';

export default function PredmetyPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showMainSuggestions, setShowMainSuggestions] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ subject_name: '', rating: 5, difficulty: 3, comment: '', author_name: '' });
  const [dict, setDict] = useState<any>(null);
  const mainSearchRef = useRef<HTMLDivElement>(null);
  const formSuggestRef = useRef<HTMLDivElement>(null);
  const [showFormSuggestions, setShowFormSuggestions] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.subjects);
    });
    return () => { isMounted = false; };
  }, [lang]);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      if (q) setSearchTerm(q);
    } catch {}
  }, []);

  const subjects = subjectsData;

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['public_subject_reviews'],
    queryFn: async () => {
      const { data } = await supabase.from('subject_reviews').select('*').eq('is_approved', true).order('created_at', { ascending: false });
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newData: any) => {
      const { error } = await supabase.from('subject_reviews').insert([newData]);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast(lang === 'cs' ? 'Recenze odeslána ke schválení!' : 'Review sent for approval!', 'success');
      setIsAdding(false);
      setFormData({ subject_name: '', rating: 5, difficulty: 3, comment: '', author_name: '' });
    }
  });

  const filteredReviews = reviews.filter(r => 
    r.subject_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!dict) {
    return (
      <div className="min-h-screen bg-stone-50 pt-24 pb-32">
        <div className="max-w-6xl mx-auto px-6">
          <header className="text-center mb-16">
            <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6 shadow-sm">
              <BookOpen size={32} />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-12 w-72 mx-auto rounded-2xl" />
              <Skeleton className="h-6 w-96 mx-auto rounded-xl" />
            </div>
          </header>
          <SkeletonList count={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-6xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6 shadow-sm">
            <BookOpen size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <div className="relative flex-grow" ref={mainSearchRef}>
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
            <input 
              type="text" 
              placeholder={dict.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowMainSuggestions(true);
              }}
              onFocus={() => setShowMainSuggestions(true)}
              className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-[2rem] shadow-xl text-stone-700 font-bold focus:ring-2 focus:ring-green-500 transition"
            />
            
            <Popover
              open={showMainSuggestions && searchTerm.length > 0}
              onClose={() => setShowMainSuggestions(false)}
              anchorRef={mainSearchRef}
              placement="bottom-start"
              offset={8}
              matchWidth
              zIndex={100}
              panelClassName="bg-white border border-stone-100 shadow-2xl rounded-[2rem] overflow-hidden max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
            >
                {subjects
                  .filter(s => 
                    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    s.code.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .slice(0, 15)
                  .map(s => (
                    <button 
                      key={s.code}
                      onClick={() => {
                        setSearchTerm(`${s.name} (${s.code}) [${s.type}]`);
                        setShowMainSuggestions(false);
                      }}
                      className="w-full text-left px-8 py-4 hover:bg-green-50 transition border-b border-stone-50 last:border-0 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-bold text-stone-700 group-hover:text-green-700 transition">{s.name}</span>
                          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{s.code}</span>
                        </div>
                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-md">{s.type}</span>
                      </div>
                    </button>
                  ))
                }
                {subjects.filter(s => 
                  s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  s.code.toLowerCase().includes(searchTerm.toLowerCase())
                ).length === 0 && (
                  <div className="px-8 py-6 text-stone-400 font-bold text-center">
                    {lang === 'cs' ? 'Nebyly nalezeny žádné odpovídající předměty.' : 'No matching subjects found.'}
                  </div>
                )}
            </Popover>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-green-600 text-white px-8 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 transition shadow-xl shadow-green-900/20 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={20} /> {dict.addReview}
          </button>
        </div>

        {isAdding && (
          <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl mb-12 border border-green-100 animate-in fade-in slide-in-from-top-8 duration-500">
            <h2 className="text-2xl font-black mb-8 text-stone-900">{dict.newReview}</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="relative" ref={formSuggestRef}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelSubject}</label>
                  <input 
                    type="text" 
                    value={formData.subject_name} 
                    onChange={e => {
                      setFormData({...formData, subject_name: e.target.value});
                      setShowFormSuggestions(true);
                    }} 
                    onFocus={() => setShowFormSuggestions(true)}
                    onBlur={() => window.setTimeout(() => setShowFormSuggestions(false), 120)}
                    className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" 
                    placeholder={dict.placeholderSubject} 
                  />
                  <Popover
                    open={
                      showFormSuggestions &&
                      formData.subject_name.length > 0 &&
                      !subjects.find(s => `${s.name} (${s.code}) [${s.type}]` === formData.subject_name)
                    }
                    onClose={() => setShowFormSuggestions(false)}
                    anchorRef={formSuggestRef}
                    placement="bottom-start"
                    offset={8}
                    matchWidth
                    zIndex={200}
                    panelClassName="bg-white border border-stone-100 shadow-2xl rounded-2xl overflow-hidden max-h-48 overflow-y-auto"
                  >
                      {subjects
                        .filter(s => 
                          s.name.toLowerCase().includes(formData.subject_name.toLowerCase()) || 
                          s.code.toLowerCase().includes(formData.subject_name.toLowerCase())
                        )
                        .slice(0, 10)
                        .map(s => (
                          <button 
                            key={s.code}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData({...formData, subject_name: `${s.name} (${s.code}) [${s.type}]`});
                              setShowFormSuggestions(false);
                            }}
                            className="w-full text-left px-6 py-3 hover:bg-green-50 transition border-b border-stone-50 last:border-0"
                          >
                            <span className="font-bold text-stone-700">{s.name}</span>
                            <span className="ml-2 text-xs font-black text-green-600 uppercase">{s.code}</span>
                            <span className="ml-2 text-[10px] font-black text-stone-300">{s.type}</span>
                          </button>
                        ))
                      }
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelRating}</label>
                    <div className="flex gap-1 bg-stone-50 p-3 rounded-2xl justify-center">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} onClick={() => setFormData({...formData, rating: star})}>
                          <Star size={24} className={star <= formData.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelDifficulty}</label>
                    <input type="range" min="1" max="5" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: parseInt(e.target.value)})} className="w-full h-12 accent-green-600" />
                    <div className="flex justify-between text-[10px] font-black text-stone-300 uppercase px-1">
                      <span>EASY</span>
                      <span>HARD</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{lang === 'cs' ? 'Jméno (nepovinné)' : 'Name (optional)'}</label>
                  <input type="text" value={formData.author_name} onChange={e => setFormData({...formData, author_name: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={lang === 'cs' ? 'Anonym' : 'Anonymous'} />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelComment}</label>
                  <textarea value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition h-[180px]" placeholder={lang === 'cs' ? 'Co by měli ostatní vědět? Jací jsou vyučující? Jak probíhá zkouška?' : 'What should others know? Who are the teachers? How is the exam?'} />
                </div>
                <button 
                  onClick={() => addMutation.mutate(formData)}
                  disabled={!formData.subject_name || !formData.comment}
                  className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-800 disabled:opacity-50 transition shadow-xl"
                >
                  {lang === 'cs' ? 'Odeslat ke schválení' : 'Submit for approval'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <SkeletonList count={3} />
        ) : (
          <div className="grid gap-8">
            {filteredReviews.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-stone-200 text-center">
                <AlertCircle className="mx-auto text-stone-200 mb-4" size={48} />
                <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.empty}</p>
              </div>
            ) : (
              filteredReviews.map((review: any) => (
                <div key={review.id} className="bg-white p-8 md:p-10 rounded-[3rem] shadow-xl border border-stone-100 group transition hover:shadow-2xl hover:border-green-100">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-grow">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={16} className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-100'} />
                          ))}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                          {lang === 'cs' ? 'Náročnost' : 'Difficulty'}: <span className="text-stone-900">{review.difficulty}/5</span>
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-stone-900 mb-4 group-hover:text-green-600 transition">{review.subject_name}</h3>
                      <p className="text-stone-600 text-lg font-medium leading-relaxed italic">
                        "{review.comment}"
                      </p>
                      <div className="mt-8 flex items-center gap-3">
                        <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                          <MessageSquare size={14} />
                        </div>
                        <span className="text-sm font-bold text-stone-400">{review.author_name || (lang === 'cs' ? 'Anonym' : 'Anonymous')} • {new Date(review.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
