import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import PageHeader from '@/app/components/ui/PageHeader';
import { getSitePageContent } from '@/lib/site/page-content';
import DbContentPage from '@/app/[lang]/components/DbContentPage';

export default async function SafetyRulesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const page = await getSitePageContent('bezpecnost', lang);
  if (page?.content_html) {
    return <DbContentPage title={page.title || (lang === 'en' ? 'Security' : 'Bezpečnost')} html={page.content_html} />;
  }
  const dict = await getDictionary(lang);
  const common: any = (dict as any)?.common || {};
  const t: any = (dict as any)?.safetyPage || {};
  const rules: string[] = Array.isArray(t.rules) ? t.rules : [];

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-4xl mx-auto px-6">
        <PageHeader
          icon={Shield}
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

        <div className="mt-8 bg-white border border-stone-100 rounded-[2rem] p-8 shadow-sm">
          <ul className="list-disc pl-5 space-y-2 text-stone-700 font-medium">
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
