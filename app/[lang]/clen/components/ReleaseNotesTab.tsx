'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Calendar, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { richTextToClientHtml } from '@/lib/richtext-client';

export default function ReleaseNotesTab() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const isEn = lang === 'en';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('posts')
          .select('id,title,title_en,excerpt,excerpt_en,category,published_at,created_at')
          .eq('category', 'Release notes')
          .not('published_at', 'is', null)
          .lte('published_at', nowIso)
          .order('published_at', { ascending: false });
        if (error) throw error;
        setItems(data || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [lang]);

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-3">
              {isEn ? 'Release notes' : 'Release notes'}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <Sparkles className="text-amber-500" />
              {isEn ? 'What’s new for members' : 'Co je nového pro členy'}
            </h2>
            <p className="text-stone-500 font-medium mt-4 max-w-2xl">
              {isEn ? 'A curated list of changes and improvements.' : 'Stručný přehled změn a vylepšení v členské sekci.'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-16 rounded-[3rem] border border-stone-100 shadow-sm flex items-center justify-center">
          <InlinePulse className="bg-stone-200" size={18} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white p-16 rounded-[3rem] border border-dashed border-stone-200 shadow-sm text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
          {isEn ? 'No release notes yet' : 'Zatím žádné release notes'}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((p) => {
            const title = isEn && p.title_en ? p.title_en : p.title;
            const excerpt = isEn && p.excerpt_en ? p.excerpt_en : p.excerpt;
            const dt = p.published_at ? new Date(p.published_at) : p.created_at ? new Date(p.created_at) : null;
            const excerptHtml = excerpt ? richTextToClientHtml(String(excerpt)) : '';
            return (
              <Link
                key={p.id}
                href={`/${lang}/novinky/${p.id}`}
                className="block bg-white p-7 rounded-[2.5rem] border border-stone-100 hover:shadow-xl hover:border-stone-200 transition"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 text-xl truncate">{title}</div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                      <Calendar size={12} />
                      {dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString(isEn ? 'en-US' : 'cs-CZ') : '—'}
                    </div>
                  </div>
                </div>
                {excerptHtml ? (
                  <div className="mt-4 text-stone-600 text-sm font-medium prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: excerptHtml }} />
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
