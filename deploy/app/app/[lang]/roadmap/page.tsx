import Link from 'next/link';
import { ArrowLeft, Route } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import PageHeader from '@/app/components/ui/PageHeader';

export default async function RoadmapPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = await getDictionary(lang);
  const common: any = (dict as any)?.common || {};
  const t: any = (dict as any)?.roadmapPage || {};

  const items: any[] = Array.isArray(t.items) ? t.items : [];

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-4xl mx-auto px-6">
        <PageHeader
          icon={Route}
          badge={t.badge || 'Roadmap'}
          title={t.title || 'Roadmap'}
          subtitle={t.subtitle || ''}
          actions={
            <Link
              href={`/${lang}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              <ArrowLeft size={16} />
              {common.back || 'Back'}
            </Link>
          }
        />

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          {items.map((it, idx) => (
            <div key={idx} className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-black text-stone-900">{it.title}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-500 bg-stone-50 border border-stone-200 px-3 py-1 rounded-full">
                  {t.statuses?.[it.status] || it.status}
                </div>
              </div>
              <div className="text-stone-600 text-sm font-medium">{it.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
