import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Lock, ArrowLeft, UserCheck, Eye, CheckCircle, Mail, Clock, KeyRound } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).privacyPage;
  const title = dict.title;
  const description = dict.intro;
  const canonical = `/${lang}/ochrana-soukromi`;
  const ogImage = '/img/prezentace_pupen.jpg';

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { 'cs-CZ': '/cs/ochrana-soukromi', 'en-US': '/en/ochrana-soukromi' },
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

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).privacyPage;

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans pb-32">
      
      {/* Jednodušší Header */}
      <header className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-stone-400 hover:text-green-600 transition font-bold text-sm">
              <ArrowLeft size={18} />
              {dict.backToHome}
            </Link>
            <Link
              href={`/${lang}/ochrana-soukromi/print`}
              className="inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-stone-800 transition"
            >
              {lang === 'en' ? 'Print' : 'Tisk'}
            </Link>
          </div>
          
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100">
              <Shield size={12} /> {dict.badgeLabel}
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
        {/* Obsah v čistém stylu bez velkých karet */}
        <div className="prose prose-stone max-w-none">
          {/* 1. SPRÁVCE */}
          <section className="space-y-6">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
              <UserCheck size={24} className="text-green-600" />
              {dict.controllerTitle}
            </h2>
            <div className="text-stone-600 leading-relaxed text-lg">
              <p>{dict.controllerText}</p>
              <div className="mt-6 p-6 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-4 w-fit">
                <Mail size={20} className="text-green-600" />
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">{dict.controllerContactPrefix}</span>
                  <a href={`mailto:${dict.controllerEmail}`} className="font-bold text-stone-900 hover:text-green-600 transition underline underline-offset-4 decoration-green-200">
                    {dict.controllerEmail}
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* 2. ROZSAH */}
          <section className="space-y-6 mt-16">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
              <Eye size={24} className="text-green-600" />
              {dict.scopeTitle}
            </h2>
            <div className="space-y-6">
              <p className="font-bold text-stone-800">{dict.scopeIntro}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {dict.scopeList?.map((item: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-4 bg-stone-50/50 rounded-xl border border-stone-50 group hover:bg-white hover:border-green-100 transition duration-300">
                    <CheckCircle size={18} className="text-green-500 shrink-0" />
                    <span className="font-bold text-stone-700 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 3. ÚČEL A DOBA */}
          <section className="space-y-6 mt-16">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
              <Lock size={24} className="text-green-600" />
              {dict.purposeTitle}
            </h2>
            <div className="space-y-6">
              <p className="text-stone-600 leading-relaxed text-lg">{dict.purposeText}</p>
              <div className="p-5 bg-green-600 text-white rounded-2xl font-bold text-sm flex items-center gap-3 shadow-lg shadow-green-600/20 w-fit">
                <Clock size={20} />
                {dict.retentionText}
              </div>
            </div>
          </section>

          {dict.oauthTitle && (
            <section className="space-y-6 mt-16">
              <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
                <KeyRound size={24} className="text-green-600" />
                {dict.oauthTitle}
              </h2>
              <div className="text-stone-600 leading-relaxed text-lg">
                <p>{dict.oauthText}</p>
              </div>
            </section>
          )}

          {/* 4. PRÁVA UŽIVATELE */}
          {dict.rightsTitle && (
            <section className="space-y-6 mt-16">
              <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight border-b pb-4 border-stone-100">
                <Shield size={24} className="text-green-600" />
                {dict.rightsTitle}
              </h2>
              <div className="text-stone-600 leading-relaxed text-lg bg-stone-50 p-8 rounded-[2rem] border border-stone-100 italic">
                {dict.rightsText}
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
