'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Calendar, ListChecks } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/get-dictionary';
import InlinePulse from '@/app/components/InlinePulse';
import PageHeader from '@/app/components/ui/PageHeader';
import EmptyState from '@/app/components/ui/EmptyState';
import { richTextToClientHtml } from '@/lib/richtext-client';

export default function ChangelogPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  const [dict, setDict] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDictionary(lang).then((d) => setDict(d));
  }, [lang]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('posts')
          .select('id,title,title_en,excerpt,excerpt_en,category,published_at,created_at')
          .eq('category', 'Changelog')
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

  const t = dict?.changelogPage || {};

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-4xl mx-auto px-6">
        <PageHeader
          icon={ListChecks}
          badge={t.badge || 'Changelog'}
          title={t.title || 'Changelog'}
          subtitle={t.subtitle || ''}
        />

        <div className="mt-8">
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <InlinePulse className="bg-stone-200" size={18} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={ListChecks} title={t.empty || ''} />
          ) : (
            <div className="space-y-4">
              {items.map((p) => {
                const title = lang === 'en' && p.title_en ? p.title_en : p.title;
                const excerpt = lang === 'en' && p.excerpt_en ? p.excerpt_en : p.excerpt;
                const dt = p.published_at ? new Date(p.published_at) : p.created_at ? new Date(p.created_at) : null;
                const excerptHtml = excerpt ? richTextToClientHtml(String(excerpt)) : '';
                return (
                  <Link
                    key={p.id}
                    href={`/${lang}/novinky/${p.id}`}
                    className="block bg-white p-6 rounded-[2rem] border border-stone-100 hover:shadow-xl hover:border-stone-200 transition"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-black text-stone-900 text-lg truncate">{title}</div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                          <Calendar size={12} />
                          {dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ') : '—'}
                        </div>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                        {p.category}
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
      </div>
    </div>
  );
}
