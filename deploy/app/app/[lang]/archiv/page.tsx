'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getDictionary } from '@/lib/get-dictionary';
import { supabase } from '@/lib/supabase';
import { Archive, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SkeletonList } from '../components/Skeleton';

export default function ArchivPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  
  const [dict, setDict] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [years, setYears] = useState<string[]>([]);
  const [table, setTable] = useState<'activity_archive' | 'archive_entries'>('activity_archive');
  const [query, setQuery] = useState('');

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      if (q) setQuery(q);
    } catch {}
    getDictionary(lang).then(d => setDict(d.archive));
    
    async function loadYears() {
      const tryLoad = async (t: 'activity_archive' | 'archive_entries') => {
        const res = await supabase.from(t).select('year');
        if (res.error) throw res.error;
        return res.data || [];
      };

      try {
        const data = await tryLoad('activity_archive');
        const uniqueYears = Array.from(new Set(data.map((d: any) => String(d.year)))).sort().reverse();
        setTable('activity_archive');
        setYears(uniqueYears as string[]);
        setSelectedYear((prev) => {
          if (uniqueYears.length === 0) return prev;
          if (!prev || !uniqueYears.includes(prev)) return uniqueYears[0] as string;
          return prev;
        });
      } catch {
        try {
          const data = await tryLoad('archive_entries');
          const uniqueYears = Array.from(new Set(data.map((d: any) => String(d.year)))).sort().reverse();
          setTable('archive_entries');
          setYears(uniqueYears as string[]);
          setSelectedYear((prev) => {
            if (uniqueYears.length === 0) return prev;
            if (!prev || !uniqueYears.includes(prev)) return uniqueYears[0] as string;
            return prev;
          });
        } catch {
          setYears([]);
        }
      }
    }
    loadYears();
  }, [lang]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['public_archive', table, selectedYear],
    queryFn: async () => {
      if (!selectedYear) return [];
      const orderCol = table === 'activity_archive' ? 'year' : 'created_at';
      const { data } = await supabase.from(table).select('*').eq('year', selectedYear).order(orderCol as any, { ascending: false });
      return data || [];
    }
  });

  if (!dict) return null;
  const q = query.trim().toLowerCase();
  const filteredEntries = q
    ? entries.filter((e: any) => {
        const hay = `${e.title || ''} ${e.title_en || ''} ${e.description || ''} ${e.description_en || ''}`.toLowerCase();
        return hay.includes(q);
      })
    : entries;

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
            <div className="mb-6 bg-white p-4 rounded-[2rem] border border-stone-100 shadow-sm">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={lang === 'en' ? 'Search…' : 'Hledat…'}
                  className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
            </div>

            {isLoading ? (
              <SkeletonList count={3} />
            ) : filteredEntries.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] text-center border border-dashed border-stone-200">
                <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.emptyYear}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredEntries.map((entry: any) => (
                  <div key={entry.id} className="bg-white p-8 md:p-10 rounded-[3rem] shadow-xl border border-stone-100 group transition hover:shadow-2xl hover:border-green-100">
                    {entry.title ? (
                      <div className="mb-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{entry.year}</div>
                        <div className="mt-2 text-2xl font-black text-stone-900 leading-tight">
                          {lang === 'en' && entry.title_en ? entry.title_en : entry.title}
                        </div>
                      </div>
                    ) : null}
                    <p className="text-xl font-bold text-stone-900 leading-relaxed whitespace-pre-line">
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
