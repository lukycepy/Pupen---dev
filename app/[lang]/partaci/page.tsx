'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Plus, Clock, Instagram, Mail } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { SkeletonGrid } from '../components/Skeleton';

import { getDictionary } from '@/lib/get-dictionary';
import InlinePulse from '@/app/components/InlinePulse';

export default function PartaciPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ author_name: '', sport: '', description: '', contact: '' });
  const [dict, setDict] = useState<any>(null);
  const [pageHtml, setPageHtml] = useState<string>('');
  const [pageTitle, setPageTitle] = useState<string>('');

  React.useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.sports);
    });
    return () => { isMounted = false; };
  }, [lang]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = new URL('/api/site-page', window.location.origin);
        url.searchParams.set('slug', 'partaci');
        url.searchParams.set('lang', lang);
        const res = await fetch(url.toString());
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const page = json?.page || null;
        if (mounted) {
          setPageHtml(String(page?.content_html || ''));
          setPageTitle(String(page?.title || ''));
        }
      } catch {
        if (mounted) {
          setPageHtml('');
          setPageTitle('');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['public_sport_partners'],
    queryFn: async () => {
      const { data } = await supabase.from('sport_partners').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newData: any) => {
      const { error } = await supabase.from('sport_partners').insert([newData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public_sport_partners'] });
      showToast(dict?.success || (lang === 'cs' ? 'Inzerát přidán!' : 'Post added!'), 'success');
      setIsAdding(false);
      setFormData({ author_name: '', sport: '', description: '', contact: '' });
    }
  });

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <Dumbbell size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        {pageHtml ? (
          <div className="bg-white border border-stone-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm mb-8">
            {pageTitle ? <div className="text-2xl font-black text-stone-900 mb-4">{pageTitle}</div> : null}
            <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
          </div>
        ) : null}

        <div className="flex justify-center mb-12">
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-green-600 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 transition shadow-xl shadow-green-900/20 flex items-center justify-center gap-3"
          >
            {isAdding ? <Plus className="rotate-45 transition-transform" size={24} /> : <Plus size={24} />} 
            {isAdding ? dict.btnCancel : dict.addRequest}
          </button>
        </div>

        {isAdding && (
          <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl mb-16 border border-green-100 animate-in fade-in slide-in-from-top-8 duration-500">
            <h2 className="text-2xl font-black mb-8 text-stone-900">{dict.newAd}</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelName}</label>
                  <input type="text" value={formData.author_name} onChange={e => setFormData({...formData, author_name: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={dict.placeholderName} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelSport}</label>
                  <input type="text" value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={dict.placeholderSport} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelContact}</label>
                  <input type="text" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={dict.placeholderContact} />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelDesc}</label>
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition h-[180px]" placeholder={dict.placeholderDesc} />
                </div>
                <button 
                  onClick={() => addMutation.mutate(formData)}
                  disabled={!formData.author_name || !formData.sport || !formData.contact || addMutation.isPending}
                  className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-800 disabled:opacity-50 transition shadow-xl flex items-center justify-center gap-2"
                >
                  {addMutation.isPending && <InlinePulse className="bg-white/80" size={14} />}
                  {dict.btnSubmit}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <SkeletonGrid count={6} />
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {partners.length === 0 ? (
              <div className="md:col-span-2 bg-white p-20 rounded-[3rem] border-2 border-dashed border-stone-200 text-center">
                <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.empty}</p>
              </div>
            ) : (
              partners.map((item: any) => (
                <div key={item.id} className="bg-white p-8 rounded-[3rem] shadow-xl border border-stone-100 group transition hover:shadow-2xl hover:border-green-100 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{item.sport}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1.5"><Clock size={12} /> {dict.added}: {new Date(item.created_at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US')}</span>
                  </div>
                  <h3 className="text-2xl font-black text-stone-900 mb-4 group-hover:text-green-600 transition">{item.author_name}</h3>
                  <p className="text-stone-600 font-medium leading-relaxed italic mb-8 flex-grow">
                    "{item.description}"
                  </p>
                  <div className="mt-auto pt-6 border-t border-stone-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-stone-400 font-bold text-sm">
                      {item.contact.includes('@') && !item.contact.startsWith('@') ? <Mail size={16} /> : <Instagram size={16} />}
                      {item.contact}
                    </div>
                    <button className="text-green-600 font-black uppercase tracking-widest text-[10px] hover:underline">
                      {dict.contactBtn}
                    </button>
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
