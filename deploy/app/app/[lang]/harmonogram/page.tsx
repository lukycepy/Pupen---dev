'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Calendar, AlertCircle, Info } from 'lucide-react';
import Skeleton from '../components/Skeleton';

import { getDictionary } from '@/lib/get-dictionary';

export default function HarmonogramPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [dict, setDict] = React.useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.schedule);
    });
    return () => { isMounted = false; };
  }, [lang]);

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['public_schedule'],
    queryFn: async () => {
      const { data } = await supabase
        .from('academic_schedule')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: true });
      return data || [];
    }
  });

  const categories = {
    exam: { color: 'bg-red-100 text-red-700 border-red-200' },
    holiday: { color: 'bg-blue-100 text-blue-700 border-blue-200' },
    event: { color: 'bg-green-100 text-green-700 border-green-200' },
    deadline: { color: 'bg-amber-100 text-amber-700 border-amber-200' },
    other: { color: 'bg-stone-100 text-stone-700 border-stone-200' }
  };

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-4xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <Calendar size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-stone-100 flex flex-col md:flex-row md:items-center gap-6">
                <div className="shrink-0 w-32 space-y-2">
                  <Skeleton className="h-3 w-16 rounded-lg" />
                  <Skeleton className="h-6 w-24 rounded-xl" />
                </div>
                <div className="flex-grow space-y-3">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-7 w-2/3 rounded-2xl" />
                </div>
                <Skeleton className="h-12 w-12 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {schedule.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] text-center border border-dashed border-stone-200">
                <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.empty}</p>
              </div>
            ) : (
              schedule.map((item: any) => (
                <div key={item.id} className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-stone-100 flex flex-col md:flex-row md:items-center gap-6 group transition hover:shadow-2xl">
                  <div className="shrink-0 w-32">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-1">{dict.dateLabel}</div>
                    <div className="font-black text-stone-900 leading-tight">
                      {new Date(item.start_date).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'short' })}
                      {item.end_date && (
                        <span className="text-stone-300 block text-xs">{dict.to} {new Date(item.end_date).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'short' })}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-grow">
                    <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-2 ${categories[item.category as keyof typeof categories]?.color || categories.other.color}`}>
                      {dict.categories[item.category] || dict.categories.other}
                    </div>
                    <h3 className="text-xl font-bold text-stone-900 group-hover:text-green-600 transition">
                      {lang === 'en' && item.title_en ? item.title_en : item.title}
                    </h3>
                  </div>

                  <div className="shrink-0">
                    <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-200 group-hover:bg-green-50 group-hover:text-green-600 transition">
                      <Info size={20} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-16 bg-stone-900 text-white p-10 rounded-[3rem] flex flex-col md:flex-row items-center gap-8">
          <div className="shrink-0 w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <AlertCircle className="text-green-500" size={32} />
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">{dict.officialTitle}</h4>
            <p className="text-stone-400 font-medium">{dict.officialDesc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
