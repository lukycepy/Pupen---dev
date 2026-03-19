'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { SkeletonGrid } from '../components/Skeleton';

export default function GuidePage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dict, setDict] = useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.guide);
    });
    return () => { isMounted = false; };
  }, [lang]);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['public_guide_articles'],
    queryFn: async () => {
      const { data } = await supabase.from('freshman_guide').select('*').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  const filteredArticles = articles.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (a.content && a.content.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-6xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <BookOpen size={32} />
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-stone-900 tracking-tighter mb-6">{dict.title}</h1>
          <p className="text-stone-500 text-xl font-medium max-w-2xl mx-auto">{dict.subtitle}</p>
        </header>

        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <div className="relative flex-grow">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
            <input 
              type="text" 
              placeholder={dict.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-[2rem] shadow-xl text-stone-700 font-bold focus:ring-2 focus:ring-green-500 transition"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {Object.entries(dict.categories).map(([key, label]: [string, any]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-8 py-5 rounded-[2rem] font-black uppercase tracking-widest transition shrink-0 shadow-lg ${
                  selectedCategory === key ? 'bg-green-600 text-white shadow-green-200' : 'bg-white text-stone-400 hover:text-stone-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredArticles.length === 0 ? (
              <div className="col-span-full bg-white p-20 rounded-[4rem] text-center border border-stone-50 shadow-xl">
                <p className="text-stone-300 font-black uppercase tracking-widest">{dict.empty}</p>
              </div>
            ) : (
              filteredArticles.map((article: any) => (
                <Link 
                  key={article.id} 
                  href={`/${lang}/pruvodce/${article.slug}`}
                  className="bg-white p-8 rounded-[3rem] shadow-xl border border-stone-50 group transition hover:shadow-2xl hover:border-green-100 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      {dict.categories[article.category] || article.category}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-stone-900 mb-4 group-hover:text-green-600 transition leading-tight">{article.title}</h3>
                  <p className="text-stone-500 font-medium mb-8 line-clamp-3 leading-relaxed">
                    {article.excerpt || article.content?.substring(0, 150) + '...'}
                  </p>
                  <div className="mt-auto flex items-center gap-2 text-green-600 font-black uppercase tracking-widest text-xs">
                    {dict.readMore} <ChevronRight size={16} className="group-hover:translate-x-1 transition" />
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
