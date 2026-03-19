'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Tag, Search, MapPin, ShoppingBag, Percent, Filter } from 'lucide-react';
import { SkeletonGrid } from '../components/Skeleton';

import { getDictionary } from '@/lib/get-dictionary';

export default function SlevyPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [searchTerm, setSearchTerm] = useState('');
  const [dict, setDict] = useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.discounts);
    });
    return () => { isMounted = false; };
  }, [lang]);

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ['public_discounts'],
    queryFn: async () => {
      const { data } = await supabase.from('isic_discounts').select('*').order('title');
      return data || [];
    }
  });

  const filteredDiscounts = discounts.filter(d => 
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-6xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <Percent size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        <div className="relative max-w-2xl mx-auto mb-16">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
          <input 
            type="text" 
            placeholder={dict.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-[2rem] shadow-xl text-stone-700 font-bold focus:ring-2 focus:ring-green-500 transition"
          />
        </div>

        {isLoading ? (
          <SkeletonGrid count={9} />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredDiscounts.length === 0 ? (
              <div className="col-span-full bg-white p-20 rounded-[3rem] text-center border border-dashed border-stone-200">
                <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.empty}</p>
              </div>
            ) : (
              filteredDiscounts.map((item: any) => (
                <div key={item.id} className="bg-white p-8 rounded-[3rem] shadow-xl border border-stone-100 group transition hover:shadow-2xl hover:border-green-100 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <span className="bg-stone-50 text-stone-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{item.category}</span>
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition">
                      <ShoppingBag size={18} />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-black text-stone-900 mb-2 group-hover:text-green-600 transition">{item.title}</h3>
                  <div className="text-3xl font-black text-green-600 mb-6">{item.discount}</div>
                  
                  <div className="mt-auto pt-6 border-t border-stone-50 flex items-center gap-2 text-stone-400 font-bold text-sm">
                    <MapPin size={16} className="text-stone-300" />
                    {item.location_name}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-20 text-center">
          <p className="text-stone-400 font-medium text-sm">
            {dict.missingTitle} <button className="text-green-600 font-bold hover:underline">{dict.missingBtn}</button>
          </p>
        </div>
      </div>
    </div>
  );
}
