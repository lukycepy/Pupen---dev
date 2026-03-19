'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getDictionary } from '@/lib/get-dictionary';
import { supabase } from '@/lib/supabase';
import { Archive } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SkeletonList } from '../components/Skeleton';

export default function ArchivPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  
  const [dict, setDict] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [years, setYears] = useState<string[]>([]);

  useEffect(() => {
    getDictionary(lang).then(d => setDict(d.archive));
    
    async function loadYears() {
      const { data } = await supabase.from('archive_entries').select('year');
      if (data) {
        const uniqueYears = Array.from(new Set(data.map(d => d.year))).sort().reverse();
        setYears(uniqueYears as string[]);
        if (uniqueYears.length > 0 && !selectedYear) setSelectedYear(uniqueYears[0] as string);
      }
    }
    loadYears();
  }, [lang, selectedYear]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['public_archive', selectedYear],
    queryFn: async () => {
      const { data } = await supabase.from('archive_entries').select('*').eq('year', selectedYear).order('created_at', { ascending: false });
      return data || [];
    }
  });

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6 shadow-sm">
            <Archive size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          <aside className="md:w-64 shrink-0">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100 sticky top-32">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">{dict.academicYear}</h3>
              <div className="space-y-1">
                {years.map(year => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-bold transition ${selectedYear === year ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-stone-600 hover:bg-stone-50'}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex-grow">
            {isLoading ? (
              <SkeletonList count={3} />
            ) : entries.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] text-center border border-dashed border-stone-200">
                <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.emptyYear}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {entries.map((entry: any) => (
                  <div key={entry.id} className="bg-white p-8 md:p-10 rounded-[3rem] shadow-xl border border-stone-100 group transition hover:shadow-2xl hover:border-green-100">
                    <p className="text-xl font-bold text-stone-900 leading-relaxed">
                      {lang === 'en' && entry.description_en ? entry.description_en : entry.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
