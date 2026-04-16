import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary } from '@/lib/get-dictionary';
import PrintButton from '@/app/components/PrintButton';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).privacyPage;
  const canonical = `/${lang}/ochrana-soukromi/print`;

  return {
    title: `${dict.title} – ${lang === 'en' ? 'Print' : 'Tisk'}`,
    alternates: { canonical },
    robots: { index: false, follow: true },
  };
}

export default async function PrivacyPrintPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).privacyPage;

  return (
    <div className="min-h-screen bg-white text-stone-900 pb-16">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print max-w-4xl mx-auto px-6 pt-10 flex items-center justify-between gap-4">
        <Link href={`/${lang}/ochrana-soukromi`} className="text-stone-500 hover:text-stone-900 font-bold text-sm">
          {lang === 'en' ? 'Back' : 'Zpět'}
        </Link>
        <PrintButton label={lang === 'en' ? 'Print' : 'Tisk'} />
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        <h1 className="text-3xl font-black mb-3">{dict.title}</h1>
        <div className="text-stone-600 font-medium mb-10">{dict.intro}</div>

        <div className="prose prose-stone max-w-none">
          <h2>{dict.controllerTitle}</h2>
          <p>{dict.controllerText}</p>
          <p>
            {dict.controllerContactPrefix} <a href={`mailto:${dict.controllerEmail}`}>{dict.controllerEmail}</a>
          </p>

          <h2>{dict.scopeTitle}</h2>
          <p>{dict.scopeIntro}</p>
          {Array.isArray(dict.scopeList) && dict.scopeList.length > 0 && (
            <ul>
              {dict.scopeList.map((x: string, i: number) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}

          <h2>{dict.purposeTitle}</h2>
          <p>{dict.purposeText}</p>
          <p>{dict.retentionText}</p>

          {dict.oauthTitle && (
            <>
              <h2>{dict.oauthTitle}</h2>
              <p>{dict.oauthText}</p>
            </>
          )}

          {dict.rightsTitle && (
            <>
              <h2>{dict.rightsTitle}</h2>
              {dict.rightsIntro && <p>{dict.rightsIntro}</p>}
              <ul>
                {(Array.isArray(dict.rightsList) && dict.rightsList.length > 0
                  ? dict.rightsList
                  : [
                      'Právo na přístup ke svým údajům a kopii dat',
                      'Právo na opravu nepřesných údajů',
                      'Právo na výmaz (právo být zapomenut), pokud pominul důvod zpracování',
                      'Právo na omezení zpracování a přenositelnost údajů',
                      'Právo vznést námitku proti zpracování na základě oprávněného zájmu',
                      'Právo odvolat udělený souhlas',
                      'Právo podat stížnost u Úřadu pro ochranu osobních údajů (www.uoou.cz)',
                    ]
                ).map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
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
