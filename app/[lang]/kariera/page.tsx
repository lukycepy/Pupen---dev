'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Building2, ExternalLink, Sparkles } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { SkeletonList } from '../components/Skeleton';

import Link from 'next/link';

export default function KarieraPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  const [dict, setDict] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then((d: any) => {
      if (isMounted) setDict(d.jobs);
    });
    return () => { isMounted = false; };
  }, [lang]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public_jobs'],
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('*').eq('is_active', true).order('created_at', { ascending: false });
      return data || [];
    }
  });

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-6xl mx-auto px-6">
        <header className="text-center mb-20">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <Briefcase size={32} />
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-stone-900 tracking-tighter mb-6">{dict.title}</h1>
          <p className="text-stone-500 text-xl font-medium max-w-2xl mx-auto">{dict.description}</p>
        </header>

        {isLoading ? (
          <SkeletonList count={3} />
        ) : (
          <div className="grid gap-8">
            {jobs.length === 0 ? (
              <div className="bg-white p-20 rounded-[4rem] shadow-xl text-center">
                <Sparkles className="mx-auto text-stone-200 mb-6" size={64} />
                <h3 className="text-2xl font-black text-stone-900 mb-2">{dict.empty}</h3>
                <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">{dict.emptySub}</p>
              </div>
            ) : (
              jobs.map((job: any) => (
                <div key={job.id} className="bg-white p-8 md:p-12 rounded-[4rem] shadow-xl border border-stone-50 group transition hover:shadow-2xl hover:border-green-100 flex flex-col md:flex-row gap-10">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5">
                        <Building2 size={12} /> {job.company}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                        {dict.added}: {new Date(job.created_at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US')}
                      </span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6 tracking-tight group-hover:text-green-600 transition">{lang === 'en' && job.title_en ? job.title_en : job.title}</h2>
                    <p className="text-stone-600 text-lg font-medium leading-relaxed mb-8">
                      {lang === 'en' && job.description_en ? job.description_en : job.description}
                    </p>
                    <a 
                      href={job.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 bg-stone-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-green-600 transition shadow-xl"
                    >
                      {dict.viewOffer} <ExternalLink size={18} />
                    </a>
                  </div>
                  <div className="hidden lg:flex w-48 h-48 bg-stone-50 rounded-[3rem] items-center justify-center shrink-0 border border-stone-100">
                    <Building2 size={64} className="text-stone-200" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-24 bg-green-600 rounded-[4rem] p-12 md:p-20 text-white text-center relative overflow-hidden shadow-2xl shadow-green-900/30">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tighter">{dict.ctaTitle}</h2>
            <p className="text-green-100 text-xl font-medium mb-12 max-w-2xl mx-auto">
              {dict.ctaDesc}
            </p>
            <Link 
              href={`/${lang}/kontakt`}
              className="inline-block bg-white text-green-700 px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-stone-900 hover:text-white transition shadow-2xl"
            >
              {dict.ctaBtn}
            </Link>
          </div>
          <div className="absolute top-0 right-0 p-20 opacity-10 pointer-events-none">
            <Briefcase size={240} />
          </div>
        </div>
      </div>
    </div>
  );
}
