import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary } from '@/lib/get-dictionary';
import PrintButton from '@/app/components/PrintButton';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).tosPage;
  const canonical = `/${lang}/tos/print`;

  return {
    title: `${dict.title} – ${lang === 'en' ? 'Print' : 'Tisk'}`,
    alternates: { canonical },
    robots: { index: false, follow: true },
  };
}

export default async function ToSPrintPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).tosPage;

  return (
    <div className="min-h-screen bg-white text-stone-900 pb-16">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print max-w-4xl mx-auto px-6 pt-10 flex items-center justify-between gap-4">
        <Link href={`/${lang}/tos`} className="text-stone-500 hover:text-stone-900 font-bold text-sm">
          {lang === 'en' ? 'Back' : 'Zpět'}
        </Link>
        <PrintButton label={lang === 'en' ? 'Print' : 'Tisk'} />
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        <h1 className="text-3xl font-black mb-3">{dict.title}</h1>
        <div className="text-stone-600 font-medium mb-10">{dict.intro}</div>

        <div className="prose prose-stone max-w-none">
          <h2>{dict.membershipTitle}</h2>
          <p>{dict.membershipText}</p>

          <h2>{dict.registrationTitle}</h2>
          <p>{dict.registrationText}</p>

          <h2>{dict.contentTitle}</h2>
          <p>{dict.contentText}</p>

          <h2>{dict.disclaimerTitle}</h2>
          <p>{dict.disclaimerText}</p>

          {dict.oauthTitle && (
            <>
              <h2>{dict.oauthTitle}</h2>
              <p>{dict.oauthText}</p>
            </>
          )}
        </div>

        <div className="mt-12 text-stone-400 text-xs font-bold">
          {dict.lastUpdated}
        </div>
      </main>
    </div>
  );
}

