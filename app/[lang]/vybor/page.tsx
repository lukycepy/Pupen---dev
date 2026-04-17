'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users, Mail, Phone } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { getDictionary } from '@/lib/get-dictionary';
import PageHeader from '@/app/components/ui/PageHeader';
import EmptyState from '@/app/components/ui/EmptyState';

type Member = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  sort_order: number | null;
};

export default function BoardPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const isEn = lang === 'en';

  const [dict, setDict] = useState<any>(null);
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
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
        url.searchParams.set('slug', 'vybor');
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
      setLoadError('');
      try {
        const res = await fetch('/api/team', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(json?.error || 'Error'));
        if (mounted) setItems((json?.items || []) as any);
      } catch {
        if (mounted) {
          setItems([]);
          setLoadError(isEn ? 'Failed to load team members.' : 'Nepodařilo se načíst členy týmu.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isEn]);

  const common = dict?.common || {};
  const t = dict?.boardPage || {};

  const board = useMemo(() => {
    const byRole = items.filter((m) => String(m.role || '').toLowerCase().includes('výbor') || String(m.role || '').toLowerCase().includes('vybor'));
    return byRole.length ? byRole : items;
  }, [items]);

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-5xl mx-auto px-6">
        <PageHeader
          icon={Users}
          badge={t.badge || (isEn ? 'Faces' : 'Tváře spolku')}
          title={t.title || (isEn ? 'Faces of the club' : 'Tváře spolku')}
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

        {pageHtml ? (
          <div className="mt-8 bg-white border border-stone-100 rounded-[2rem] p-8 shadow-sm">
            {pageTitle ? <div className="text-2xl font-black text-stone-900 mb-4">{pageTitle}</div> : null}
            <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
          </div>
        ) : null}

        <div className="mt-8">
          {loading ? (
              <div className="py-16 flex items-center justify-center">
                <InlinePulse className="bg-stone-200" size={18} />
              </div>
            ) : board.length === 0 ? (
              <EmptyState
                icon={Users}
                title={
                  loadError
                    ? (isEn ? 'Unable to display team' : 'Nelze zobrazit tým')
                    : (t.empty || (isEn ? 'No entries yet' : 'Zatím žádné tváře spolku'))
                }
                description={loadError || undefined}
              />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {board.map((m) => (
                  <div key={m.id} className="bg-white border border-stone-100 rounded-[2rem] p-7 shadow-sm">
                    <div className="font-black text-stone-900 text-xl">{m.name}</div>
                    {m.role ? (
                      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                        {m.role}
                      </div>
                    ) : null}
                    <div className="mt-5 grid gap-2">
                      {m.email ? (
                        <a className="inline-flex items-center gap-2 font-bold text-stone-700 hover:text-green-700 transition" href={`mailto:${m.email}`}>
                          <Mail size={16} className="text-green-600" /> {m.email}
                        </a>
                      ) : null}
                      {m.phone ? (
                        <a className="inline-flex items-center gap-2 font-bold text-stone-700 hover:text-green-700 transition" href={`tel:${m.phone}`}>
                          <Phone size={16} className="text-green-600" /> {m.phone}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
