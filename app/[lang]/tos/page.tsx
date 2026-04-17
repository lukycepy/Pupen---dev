import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft, CheckCircle, Gavel, Copyright, AlertTriangle, KeyRound } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { getSitePageContent } from '@/lib/site/page-content';
import DbContentPage from '@/app/[lang]/components/DbContentPage';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).tosPage;
  const title = dict.title;
  const description = dict.intro;
  const canonical = `/${lang}/tos`;
  const ogImage = '/img/prezentace_pupen.jpg';

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { 'cs-CZ': '/cs/tos', 'en-US': '/en/tos' },
    },
    openGraph: {
      title,
      description,
      url: `https://pupen.org${canonical}`,
      type: 'article',
      images: [{ url: ogImage }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}

export default async function ToSPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const page = await getSitePageContent('tos', lang);
  if (page?.content_html) {
    return <DbContentPage title={page.title || (lang === 'en' ? 'Terms of service' : 'Podmínky')} html={page.content_html} />;
  }
  const dict = (await getDictionary(lang)).tosPage;

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans pb-32">
      
      {/* Hero Header */}
      <header className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-stone-400 hover:text-amber-600 transition font-bold text-sm">
              <ArrowLeft size={18} />
              {dict.backToHome}
            </Link>
            <Link
              href={`/${lang}/tos/print`}
              className="inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-stone-800 transition"
            >
              {lang === 'en' ? 'Print' : 'Tisk'}
            </Link>
          </div>
          
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
              <Gavel size={12} /> {dict.badgeLabel}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900">
              {dict.title}
            </h1>
            <p className="text-lg text-stone-500 font-medium max-w-2xl leading-relaxed">
              {dict.intro}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 space-y-16">
        <div className="prose prose-stone max-w-none">
          {/* 1. ČLENSTVÍ */}
          <section className="space-y-6">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
              <Shield size={24} className="text-amber-600" />
              {dict.membershipTitle}
            </h2>
            <div className="text-stone-600 leading-relaxed text-lg">
              {dict.membershipText}
            </div>
          </section>

          {/* 2. REGISTRACE */}
          <section className="space-y-6 mt-16">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
              <CheckCircle size={24} className="text-amber-600" />
              {dict.registrationTitle}
            </h2>
            <div className="text-stone-600 leading-relaxed text-lg">
              {dict.registrationText}
            </div>
          </section>

          {/* 3. AUTORSKÁ PRÁVA */}
          <section className="space-y-6 mt-16">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
              <Copyright size={24} className="text-amber-600" />
              {dict.contentTitle}
            </h2>
            <div className="text-stone-600 leading-relaxed text-lg">
              {dict.contentText}
            </div>
          </section>

          {/* 4. ODPOVĚDNOST */}
          <section className="space-y-6 mt-16">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
              <AlertTriangle size={24} className="text-amber-600" />
              {dict.disclaimerTitle}
            </h2>
            <div className="p-8 bg-amber-50 rounded-[2rem] border border-amber-100">
              <p className="text-amber-900 leading-relaxed text-lg font-bold italic">{dict.disclaimerText}</p>
            </div>
          </section>

          {dict.oauthTitle && (
            <section className="space-y-6 mt-16">
              <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
                <KeyRound size={24} className="text-amber-600" />
                {dict.oauthTitle}
              </h2>
              <div className="text-stone-600 leading-relaxed text-lg">
                {dict.oauthText}
              </div>
            </section>
          )}
        </div>

        {/* Patička */}
        <div className="text-center text-stone-400 text-[10px] font-black uppercase tracking-[0.3em] mt-24 pt-12 border-t border-stone-100">
          <p>{dict.lastUpdated}</p>
        </div>
      </main>
    </div>
  );
}
