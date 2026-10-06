'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Clock, Coffee, BookOpen, UserCheck, AlertCircle } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import Skeleton from '../components/Skeleton';
import { useSitePageContent } from '@/app/[lang]/components/useSitePageContent';

export default function OteviraciDobaPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const page = useSitePageContent('oteviraci-doba', lang);
  const [dict, setDict] = useState<any>(null);

  useEffect(() => {
    getDictionary(lang).then(d => setDict(d.openingHours));
  }, [lang]);

  const { data: hours = [], isLoading } = useQuery({
    queryKey: ['public_opening_hours'],
    queryFn: async () => {
      const { data } = await supabase.from('opening_hours').select('*').order('place_name');
      return data || [];
    }
  });

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('bufet') || n.includes('kafe') || n.includes('menza')) return <Coffee size={24} />;
    if (n.includes('knihov') || n.includes('sic')) return <BookOpen size={24} />;
    if (n.includes('studij')) return <UserCheck size={24} />;
    return <Clock size={24} />;
  };

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        {page.html ? (
          <div className="bg-white border border-stone-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm mb-8">
            {page.title ? <div className="text-2xl md:text-4xl font-black text-stone-900 tracking-tight mb-6">{page.title}</div> : null}
            <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: page.html }} />
          </div>
        ) : null}
        <header className="text-center mb-20">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <Clock size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white p-8 md:p-10 rounded-[3rem] shadow-xl border border-stone-100 space-y-8">
                <div className="flex items-start justify-between">
                  <Skeleton className="w-14 h-14 rounded-2xl" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-8 w-2/3 rounded-2xl" />
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-3 border-b border-stone-50">
                    <Skeleton className="h-4 w-16 rounded-lg" />
                    <Skeleton className="h-6 w-24 rounded-lg" />
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-stone-50">
                    <Skeleton className="h-4 w-16 rounded-lg" />
                    <Skeleton className="h-6 w-24 rounded-lg" />
                  </div>
                </div>
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {hours.length === 0 ? (
              <div className="col-span-full bg-white p-20 rounded-[3rem] text-center border border-dashed border-stone-200">
                <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.empty}</p>
              </div>
            ) : (
              hours.map((item: any) => (
                <div key={item.id} className="bg-white p-8 md:p-10 rounded-[3rem] shadow-xl border border-stone-100 group transition hover:shadow-2xl hover:border-green-100">
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-green-50 group-hover:text-green-600 transition">
                      {getIcon(item.place_name)}
                    </div>
                    {item.note && (
                      <div className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-100">
                        {dict.infoInside}
                      </div>
                    )}
                  </div>

                  <h3 className="text-2xl font-black text-stone-900 mb-8">{item.place_name}</h3>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between py-3 border-b border-stone-50">
                      <span className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">{dict.monFri}</span>
                      <span className="font-black text-stone-900">{item.hours_mon_fri || dict.closed}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-stone-50">
                      <span className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">{dict.satSun}</span>
                      <span className="font-black text-stone-900">{item.hours_sat_sun || dict.closed}</span>
                    </div>
                  </div>

                  {item.note && (
                    <div className="mt-8 p-4 bg-stone-50 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="text-stone-300 shrink-0" size={18} />
                      <p className="text-stone-500 text-sm font-medium italic">{item.note}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-20 bg-stone-900 text-white p-10 rounded-[3rem] text-center">
          <p className="text-stone-400 font-medium">
            {dict.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
