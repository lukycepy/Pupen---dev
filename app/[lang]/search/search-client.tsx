'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Calendar, FileText, HelpCircle, BookOpen, Tag, Archive } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { richTextToClientHtml } from '@/lib/richtext-client';
import { stripHtmlToText } from '@/lib/richtext-shared';

type Results = {
  events: any[];
  posts: any[];
  faqs: any[];
  books: any[];
  discounts: any[];
  guide: any[];
  archive: any[];
};

export default function SearchClient({ lang, initialQ }: { lang: string; initialQ: string }) {
  const [q, setQ] = useState(initialQ || '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results>({ events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });

  useEffect(() => {
    setQ(initialQ || '');
  }, [initialQ]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults({ events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });
      setLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL('/api/search', window.location.origin);
        url.searchParams.set('q', query);
        url.searchParams.set('lang', lang);
        url.searchParams.set('limit', '10');
        const res = await fetch(url.toString());
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Chyba');
        setResults(json?.results || { events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });
      } catch {
        setResults({ events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] });
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [lang, q]);

  const total = useMemo(
    () =>
      results.events.length +
      results.posts.length +
      results.faqs.length +
      results.books.length +
      results.discounts.length +
      results.guide.length +
      results.archive.length,
    [results],
  );

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
          <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">
                {lang === 'en' ? 'Global search' : 'Globální vyhledávání'}
              </div>
              <h1 className="mt-2 text-3xl md:text-5xl font-black tracking-tight text-stone-900">
                {lang === 'en' ? 'Search' : 'Vyhledávání'}
              </h1>
              <p className="mt-3 text-stone-500 font-medium">
                {lang === 'en' ? 'Events, news and FAQ in one place.' : 'Akce, novinky a FAQ na jednom místě.'}
              </p>
            </div>

            <Link
              href={`/${lang}`}
              className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              {lang === 'en' ? 'Home' : 'Domů'}
            </Link>
          </div>

          <div className="mt-8 relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={lang === 'en' ? 'Search…' : 'Hledat…'}
              className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-12 pr-12 py-4 text-sm font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
            />
            {loading ? <InlinePulse className="absolute right-5 top-5 bg-stone-200" size={14} /> : null}
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {q.trim().length < 2 ? (
            <div className="bg-white rounded-[2.5rem] border border-dashed border-stone-200 p-14 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              {lang === 'en' ? 'Type at least 2 characters' : 'Napiš alespoň 2 znaky'}
            </div>
          ) : !loading && total === 0 ? (
            <div className="bg-white rounded-[2.5rem] border border-dashed border-stone-200 p-14 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              {lang === 'en' ? 'No results' : 'Žádné výsledky'}
            </div>
          ) : (
            <>
              {results.events.length > 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">
                    {lang === 'en' ? 'Events' : 'Akce'}
                  </div>
                  <div className="space-y-1">
                    {results.events.map((ev) => (
                      <Link
                        key={ev.id}
                        href={`/${lang}/akce/${ev.id}`}
                        className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                      >
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                          <Calendar size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-700 truncate">{ev.title}</div>
                          {ev.date ? (
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                              {new Date(ev.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                              {ev.location ? ` • ${ev.location}` : ''}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {results.posts.length > 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">
                    {lang === 'en' ? 'News' : 'Novinky'}
                  </div>
                  <div className="space-y-1">
                    {results.posts.map((po) => (
                      <Link
                        key={po.id}
                        href={`/${lang}/novinky/${po.id}`}
                        className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                      >
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-700 truncate">{po.title}</div>
                          {po.excerpt ? (
                            <div className="text-sm text-stone-500 font-medium line-clamp-1 mt-1">
                              {stripHtmlToText(richTextToClientHtml(String(po.excerpt || '')))}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {results.faqs.length > 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">FAQ</div>
                  <div className="space-y-1">
                    {results.faqs.map((f) => (
                      <Link
                        key={f.id}
                        href={`/${lang}/faq?q=${encodeURIComponent(q.trim())}`}
                        className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                      >
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                          <HelpCircle size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-700 truncate">{f.question}</div>
                          {f.category ? (
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">{f.category}</div>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {results.guide.length > 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">
                    {lang === 'en' ? 'Guide' : 'Průvodce'}
                  </div>
                  <div className="space-y-1">
                    {results.guide.map((a) => (
                      <Link
                        key={a.id}
                        href={`/${lang}/pruvodce/${a.slug}`}
                        className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                      >
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                          <BookOpen size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-700 truncate">{a.title}</div>
                          {a.category ? (
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">{a.category}</div>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {results.discounts.length > 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">
                    {lang === 'en' ? 'Discounts' : 'Slevy'}
                  </div>
                  <div className="space-y-1">
                    {results.discounts.map((d) => (
                      <Link
                        key={d.id}
                        href={`/${lang}/slevy?q=${encodeURIComponent(q.trim())}`}
                        className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                      >
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                          <Tag size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-700 truncate">{d.title}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                            {d.category ? d.category : ''}
                            {d.discount ? ` • ${d.discount}` : ''}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {results.books.length > 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">
                    {lang === 'en' ? 'Book exchange' : 'Burza'}
                  </div>
                  <div className="space-y-1">
                    {results.books.map((b) => (
                      <Link
                        key={b.id}
                        href={`/${lang}/burza?q=${encodeURIComponent(q.trim())}`}
                        className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                      >
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                          <BookOpen size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-700 truncate">{b.title}</div>
                          {b.author ? (
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">{b.author}</div>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {results.archive.length > 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">
                    {lang === 'en' ? 'Archive' : 'Archiv'}
                  </div>
                  <div className="space-y-1">
                    {results.archive.map((a) => (
                      <Link
                        key={a.id}
                        href={`/${lang}/archiv?q=${encodeURIComponent(q.trim())}`}
                        className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition group/item"
                      >
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover/item:bg-green-600 group-hover/item:text-white transition shadow-sm border border-stone-100">
                          <Archive size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-700 truncate">{a.title || (lang === 'en' ? 'Entry' : 'Záznam')}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                            {a.year ? String(a.year) : ''}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
