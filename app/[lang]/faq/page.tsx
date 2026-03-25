'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { HelpCircle, Search, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { supabase } from '@/lib/supabase';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  question_en?: string | null;
  answer_en?: string | null;
  category?: string | null;
  sort_order?: number | null;
  is_public?: boolean | null;
};

export default function FaqPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  const [dict, setDict] = useState<any>(null);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('Vše');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      setQuery(q);
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    getDictionary(lang)
      .then((d) => {
        if (!mounted) return;
        setDict(d);
      })
      .catch(() => {
        if (!mounted) return;
        setDict({});
      });
    return () => {
      mounted = false;
    };
  }, [lang]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('faqs')
          .select('*')
          .eq('is_public', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (!mounted) return;
        setFaqs((data as any[]) || []);
      } catch {
        if (!mounted) return;
        setFaqs([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of faqs || []) {
      const c = (f.category || '').trim();
      if (c) set.add(c);
    }
    return ['Vše', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [faqs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (faqs || []).filter((f) => {
      if (category !== 'Vše' && (f.category || '') !== category) return false;
      if (!q) return true;
      const question = (lang === 'en' && f.question_en ? f.question_en : f.question) || '';
      const answer = (lang === 'en' && f.answer_en ? f.answer_en : f.answer) || '';
      const hay = `${question}\n${answer}\n${f.category || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [category, faqs, lang, query]);

  if (!dict) return null;

  const title = (dict as any)?.tools?.faq?.title || (lang === 'en' ? 'FAQ' : 'FAQ');
  const subtitle = (dict as any)?.tools?.faq?.sub || (lang === 'en' ? 'Frequently asked questions' : 'Časté dotazy');

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        <header className="mb-12">
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-stone-400 font-bold hover:text-green-600 transition mb-6 group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> {lang === 'cs' ? 'Zpět domů' : 'Back home'}
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-2xl shadow-sm">
              <HelpCircle size={32} />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter">{title}</h1>
          </div>
          <p className="text-stone-500 text-lg max-w-2xl font-medium">{subtitle}</p>
        </header>

        <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search…' : 'Hledat…'}
                className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c);
                    setExpandedId(null);
                  }}
                  className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    category === c ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-100' : 'bg-white text-stone-500 border-stone-100 hover:border-stone-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {loading ? (
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 text-stone-400 font-bold uppercase tracking-widest text-xs">
              {lang === 'en' ? 'Loading…' : 'Načítám…'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-dashed border-stone-200 p-12 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              {lang === 'en' ? 'No results' : 'Žádné výsledky'}
            </div>
          ) : (
            filtered.map((f) => {
              const q = (lang === 'en' && f.question_en ? f.question_en : f.question) || '';
              const a = (lang === 'en' && f.answer_en ? f.answer_en : f.answer) || '';
              const open = expandedId === f.id;
              return (
                <div key={f.id} className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : f.id)}
                    className="w-full p-6 text-left flex items-start justify-between gap-4 hover:bg-stone-50 transition"
                  >
                    <div>
                      <div className="text-sm font-black text-stone-900 leading-snug">{q}</div>
                      {f.category ? (
                        <div className="mt-2 inline-flex items-center rounded-xl bg-stone-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-stone-400 border border-stone-100">
                          {f.category}
                        </div>
                      ) : null}
                    </div>
                    {open ? <ChevronUp size={18} className="text-green-600 shrink-0 mt-0.5" /> : <ChevronDown size={18} className="text-stone-300 shrink-0 mt-0.5" />}
                  </button>
                  {open ? (
                    <div className="px-6 pb-6 text-sm text-stone-600 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200 whitespace-pre-line">
                      {a}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-12 bg-white rounded-[2rem] border border-stone-100 p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">{lang === 'en' ? 'Still need help?' : 'Nenašli jste odpověď?'}</div>
            <div className="mt-2 text-lg font-black text-stone-900">{lang === 'en' ? 'Write us' : 'Napište nám'}</div>
          </div>
          <Link
            href={`/${lang}/kontakt`}
            className="inline-flex items-center justify-center bg-stone-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition shadow-xl shadow-stone-900/10"
          >
            {lang === 'en' ? 'Contact' : 'Kontakt'}
          </Link>
        </div>
      </div>
    </div>
  );
}
