import Link from 'next/link';
import { HeartHandshake, ArrowLeft } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { getSitePageContent } from '@/lib/site/page-content';
import PageHeader from '@/app/components/ui/PageHeader';
import Panel from '@/app/components/ui/Panel';

export default async function DonatePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = await getDictionary(lang);
  const common = dict?.common || {};

  const page = await getSitePageContent('daruj', lang);
  const title = page?.title || (lang === 'en' ? 'Donate' : 'Daruj');
  const subtitle = lang === 'en' ? 'Support Pupen, z.s.' : 'Podpořte Pupen, z.s.';

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-3xl mx-auto px-6">
        <PageHeader
          icon={HeartHandshake}
          badge={lang === 'en' ? 'Donate' : 'Daruj'}
          title={title}
          subtitle={subtitle}
          actions={
            <Link
              href={`/${lang}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              <ArrowLeft size={16} />
              {common.back || (lang === 'en' ? 'Back' : 'Zpět')}
            </Link>
          }
        />

        <Panel className="mt-8" padded>
          {page?.content_html ? (
            <div className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm">
              <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: page.content_html }} />
            </div>
          ) : (
            <div className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm">
              <div className="text-sm text-stone-600 font-medium">
                {lang === 'en'
                  ? 'Donation page content is not set yet. You can edit it in Admin → Pages.'
                  : 'Obsah stránky pro dary ještě není nastavený. Upravte ho v Admin → Stránky.'}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
