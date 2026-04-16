import Link from 'next/link';
import { ArrowLeft, HeartPulse } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import PageHeader from '@/app/components/ui/PageHeader';

export default async function FirstAidPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = await getDictionary(lang);
  const common: any = (dict as any)?.common || {};
  const t: any = (dict as any)?.firstAidPage || {};
  const cards: any[] = Array.isArray(t.cards) ? t.cards : [];

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-4xl mx-auto px-6">
        <PageHeader
          icon={HeartPulse}
          badge={t.badge || ''}
          title={t.title || ''}
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
          {cards.map((it, idx) => (
            <div key={idx} className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm">
              <div className="font-black text-stone-900">{it.title}</div>
              <div className="text-stone-600 text-sm font-medium mt-2">{it.text}</div>
            </div>
          ))}
        </div>

        {t.footerNote ? (
          <div className="mt-8 text-stone-400 text-xs font-bold">
            {t.footerNote}
          </div>
        ) : null}
      </div>
    </div>
  );
}
