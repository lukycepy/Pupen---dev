'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, Search, ArrowLeft, BookOpen, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getDictionary } from '@/lib/get-dictionary';
import Link from 'next/link';
import { useToast } from '../../context/ToastContext';
import { SkeletonGrid } from '../components/Skeleton';

export default function BurzaPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  
  const [dict, setDict] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', author: '', price: '', contact: '', hp: '' });
  const { showToast } = useToast();
  const isDisabled = true;

  useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.books);
    });
    return () => { isMounted = false; };
  }, [lang]);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      if (q) setSearchTerm(q);
    } catch {}
  }, []);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['public_books'],
    queryFn: async () => {
      const { data } = await supabase.from('book_exchange').select('*').eq('status', 'active').eq('is_sold', false).order('created_at', { ascending: false });
      return data || [];
    }
  });

  const saveMutation = async () => {
    if (isDisabled) {
      showToast(lang === 'cs' ? 'Burza učebnic je ukončena.' : 'Book exchange is discontinued.', 'error');
      return;
    }
    // Basic validation
    if (!formData.title || !formData.author || !formData.contact || !formData.price) {
      showToast(lang === 'cs' ? 'Vyplňte všechna pole' : 'Please fill all fields', 'error');
      return;
    }

    try {
      const res = await fetch('/api/burza/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Něco se nepovedlo.');

      showToast(dict.saveSuccess, 'success');
      setIsAdding(false);
      setFormData({ title: '', author: '', price: '', contact: '', hp: '' });
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredBooks = books.filter((book: any) => 
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    book.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-6xl mx-auto px-6">
        <header className="mb-16">
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-stone-400 font-black uppercase tracking-widest text-[10px] hover:text-green-600 transition mb-8">
            <ArrowLeft size={14} /> {lang === 'cs' ? 'Zpět domů' : 'Back home'}
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 text-left">
            <div>
              <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6 shadow-sm">
                <BookOpen size={32} />
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
              <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
              <div className="mt-4 inline-flex items-center gap-2 bg-stone-100 text-stone-700 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-stone-200">
                <Star size={14} />
                {lang === 'cs' ? 'Burza je ukončena (read-only)' : 'Discontinued (read-only)'}
              </div>
            </div>
            {!isDisabled ? (
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="bg-stone-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition shadow-xl shadow-stone-200 flex items-center gap-2"
              >
                <Plus size={16} /> {dict.sellBtn}
              </button>
            ) : null}
          </div>
        </header>

        {isAdding && !isDisabled && (
          <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl mb-16 border border-green-100 animate-in fade-in slide-in-from-top-8 duration-500">
            <h2 className="text-2xl font-black mb-8 text-stone-900">{dict.newAd}</h2>
            {/* Honeypot field */}
            <input
              type="text"
              name="website"
              value={formData.hp}
              onChange={(e) => setFormData({...formData, hp: e.target.value})}
              className="opacity-0 absolute -z-10 w-0 h-0"
              tabIndex={-1}
              autoComplete="off"
            />
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.bookTitle}</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={dict.bookTitle} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.author}</label>
                  <input type="text" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={dict.author} />
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.price}</label>
                    <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.contact}</label>
                    <input type="text" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={dict.contactPlaceholder} />
                  </div>
                </div>
                <button 
                  onClick={saveMutation}
                  disabled={!formData.title || !formData.author || !formData.contact}
                  className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-green-600 disabled:opacity-50 transition shadow-xl"
                >
                  {dict.btnSave}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="relative mb-12">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input 
            type="text" 
            placeholder={dict.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-none rounded-[2rem] pl-16 pr-8 py-6 text-lg font-bold text-stone-700 shadow-sm focus:ring-2 focus:ring-green-500 transition"
          />
        </div>

        {isLoading ? (
          <SkeletonGrid count={9} />
        ) : filteredBooks.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] text-center border border-dashed border-stone-200">
            <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.empty}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBooks.map((book: any) => (
              <div key={book.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-stone-100 group transition hover:shadow-2xl hover:border-green-100 flex flex-col">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600 mb-4">
                    <Star size={12} fill="currentColor" />
                    <span>{book.price} {dict.priceLabel}</span>
                  </div>
                  <h3 className="text-2xl font-black text-stone-900 mb-2 line-clamp-2">{book.title}</h3>
                  <p className="text-stone-400 font-bold mb-8 uppercase tracking-widest text-xs">{book.author}</p>
                </div>

                <div className="pt-8 border-t border-stone-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 px-1">{dict.sellerContact}</p>
                  <div className="bg-stone-50 p-4 rounded-2xl font-black text-stone-900 break-all">
                    {book.contact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
