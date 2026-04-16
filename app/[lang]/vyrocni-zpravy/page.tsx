'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileText, ArrowLeft, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { getDictionary } from '@/lib/get-dictionary';
import PageHeader from '@/app/components/ui/PageHeader';
import EmptyState from '@/app/components/ui/EmptyState';

export default function AnnualReportsPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const isEn = lang === 'en';

  const [dict, setDict] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageHtml, setPageHtml] = useState<string>('');
  const [pageTitle, setPageTitle] = useState<string>('');

  useEffect(() => {
    getDictionary(lang).then((d) => setDict(d));
  }, [lang]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = new URL('/api/site-page', window.location.origin);
        url.searchParams.set('slug', 'vyrocni-zpravy');
        url.searchParams.set('lang', lang);
        const res = await fetch(url.toString());
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const page = json?.page || null;
        if (mounted) {
          setPageHtml(String(page?.content_html || ''));
          setPageTitle(String(page?.title || ''));
        }
      } catch {
        if (mounted) {
          setPageHtml('');
          setPageTitle('');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('id,title,title_en,category,file_url,created_at')
          .eq('access_level', 'public')
          .or('category.ilike.%Výroční%,category.ilike.%Annual%')
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        if (mounted) setItems(data || []);
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const common = dict?.common || {};
  const t = dict?.annualReportsPage || {};

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-4xl mx-auto px-6">
        <PageHeader
          icon={FileText}
          badge={t.badge || (isEn ? 'Annual reports' : 'Výroční zprávy')}
          title={t.title || (isEn ? 'Annual reports' : 'Výroční zprávy')}
          subtitle={t.subtitle || ''}
          actions={
            <Link
              href={`/${lang}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              <ArrowLeft size={16} />
              {common.back || (isEn ? 'Back' : 'Zpět')}
            </Link>
          }
        />

        <div className="mt-8">
          {pageHtml ? (
            <div className="bg-white border border-stone-100 rounded-[2rem] p-8 shadow-sm mb-6">
              {pageTitle ? <div className="text-xl font-black text-stone-900 mb-4">{pageTitle}</div> : null}
              <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
            </div>
          ) : null}
          {loading ? (
              <div className="py-16 flex items-center justify-center">
                <InlinePulse className="bg-stone-200" size={18} />
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={FileText} title={t.empty || (isEn ? 'No reports yet' : 'Zatím žádné zprávy')} />
            ) : (
              <div className="space-y-3">
                {items.map((d) => (
                  <a
                    key={d.id}
                    href={String(d.file_url || '#')}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-white border border-stone-100 rounded-[2rem] p-6 hover:shadow-xl hover:border-stone-200 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-black text-stone-900 truncate">
                          {isEn && d.title_en ? d.title_en : d.title}
                        </div>
                        <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                          {d.category}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 text-stone-700 font-bold">
                        <Download size={16} />
                        {common.open || (isEn ? 'Open' : 'Otevřít')}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
