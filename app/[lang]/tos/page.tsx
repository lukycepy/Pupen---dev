import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, FileText, Scale, AlertCircle, KeyRound, BookOpen, Ban } from 'lucide-react';
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
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">

      {/* Hero Header */}
      <header className="relative overflow-hidden bg-stone-900 text-white pt-24 pb-32 px-6">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/60 via-stone-900 to-stone-950" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-green-600/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-12">
            <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition font-bold text-sm">
              <ArrowLeft size={18} />
              {dict.backToHome}
            </Link>
            <Link
              href={`/${lang}/tos/print`}
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-white/20 transition border border-white/10"
            >
              {lang === 'en' ? 'Print' : 'Tisk'}
            </Link>
          </div>

          <div className="flex items-start gap-5">
            <div className="bg-green-600/20 p-4 rounded-2xl border border-green-500/30 backdrop-blur-xl shrink-0">
              <Scale size={36} className="text-green-400" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/30 mb-4">
                <FileText size={12} /> Právní dokument
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-4">
                {dict.title}
              </h1>
              <p className="text-lg text-stone-400 font-medium max-w-2xl leading-relaxed">
                {dict.intro}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Floating nav */}
      <div className="max-w-4xl mx-auto px-6 -mt-8 relative z-20">
        <div className="bg-white rounded-2xl shadow-xl border border-stone-100 p-3 flex flex-wrap gap-2">
          {[
            { label: lang === 'en' ? 'Membership' : 'Členství', icon: BookOpen },
            { label: lang === 'en' ? 'Registration' : 'Registrace', icon: CheckCircle },
            { label: lang === 'en' ? 'Copyright' : 'Autorská práva', icon: AlertCircle },
            { label: lang === 'en' ? 'Liability' : 'Odpovědnost', icon: Ban },
            { label: lang === 'en' ? 'OAuth' : 'OAuth přihlášení', icon: KeyRound },
          ].map((item, i) => (
            <a key={i} href={`#section-${i + 1}`} className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 hover:bg-stone-100 rounded-xl text-stone-600 hover:text-stone-900 font-bold text-xs transition">
              <item.icon size={14} className="text-green-600" />
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-20 space-y-12">
        {/* 1. ČLENSTVÍ */}
        <section id="section-1" className="bg-white rounded-[2.5rem] p-10 md:p-14 shadow-lg border border-stone-100">
          <div className="flex items-start gap-5 mb-8">
            <div className="bg-green-50 p-3 rounded-2xl border border-green-100 shrink-0">
              <BookOpen size={28} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-stone-900 mb-2">{dict.membershipTitle}</h2>
              <p className="text-stone-400 font-medium text-sm">{lang === 'en' ? 'Membership conditions' : 'Podmínky členství'}</p>
            </div>
          </div>
          <div className="p-8 bg-gradient-to-br from-green-50 to-stone-50 rounded-[2rem] border border-green-100">
            <p className="text-stone-700 leading-[1.9] text-lg font-medium">{dict.membershipText}</p>
          </div>
        </section>

        {/* 2. REGISTRACE */}
        <section id="section-2" className="bg-white rounded-[2.5rem] p-10 md:p-14 shadow-lg border border-stone-100">
          <div className="flex items-start gap-5 mb-8">
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 shrink-0">
              <CheckCircle size={28} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-stone-900 mb-2">{dict.registrationTitle}</h2>
              <p className="text-stone-400 font-medium text-sm">{lang === 'en' ? 'Registration process' : 'Proces registrace'}</p>
            </div>
          </div>
          <div className="p-8 bg-gradient-to-br from-blue-50 to-stone-50 rounded-[2rem] border border-blue-100">
            <p className="text-stone-700 leading-[1.9] text-lg font-medium">{dict.registrationText}</p>
          </div>
        </section>

        {/* 3. AUTORSKÁ PRÁVA */}
        <section id="section-3" className="bg-white rounded-[2.5rem] p-10 md:p-14 shadow-lg border border-stone-100">
          <div className="flex items-start gap-5 mb-8">
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 shrink-0">
              <AlertCircle size={28} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-stone-900 mb-2">{dict.contentTitle}</h2>
              <p className="text-stone-400 font-medium text-sm">{lang === 'en' ? 'Intellectual property' : 'Duševní vlastnictví'}</p>
            </div>
          </div>
          <div className="p-8 bg-gradient-to-br from-amber-50 to-stone-50 rounded-[2rem] border border-amber-100">
            <p className="text-stone-700 leading-[1.9] text-lg font-medium">{dict.contentText}</p>
          </div>
        </section>

        {/* 4. ODPOVĚDNOST */}
        <section id="section-4" className="bg-white rounded-[2.5rem] p-10 md:p-14 shadow-lg border border-stone-100">
          <div className="flex items-start gap-5 mb-8">
            <div className="bg-red-50 p-3 rounded-2xl border border-red-100 shrink-0">
              <Ban size={28} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-stone-900 mb-2">{dict.disclaimerTitle}</h2>
              <p className="text-stone-400 font-medium text-sm">{lang === 'en' ? 'Limitation of liability' : 'Omezení odpovědnosti'}</p>
            </div>
          </div>
          <div className="p-8 bg-gradient-to-br from-red-50 to-stone-50 rounded-[2rem] border border-red-100">
            <p className="text-red-900 leading-[1.9] text-lg font-bold">{dict.disclaimerText}</p>
          </div>
        </section>

        {/* 5. OAUTH */}
        {dict.oauthTitle && (
          <section id="section-5" className="bg-white rounded-[2.5rem] p-10 md:p-14 shadow-lg border border-stone-100">
            <div className="flex items-start gap-5 mb-8">
              <div className="bg-violet-50 p-3 rounded-2xl border border-violet-100 shrink-0">
                <KeyRound size={28} className="text-violet-600" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-stone-900 mb-2">{dict.oauthTitle}</h2>
                <p className="text-stone-400 font-medium text-sm">{lang === 'en' ? 'Third-party login' : 'Přihlášení třetími stranami'}</p>
              </div>
            </div>
            <div className="p-8 bg-gradient-to-br from-violet-50 to-stone-50 rounded-[2rem] border border-violet-100">
              <p className="text-stone-700 leading-[1.9] text-lg font-medium">{dict.oauthText}</p>
            </div>
          </section>
        )}
      </main>

      {/* Patička */}
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center text-stone-400 text-[11px] font-black uppercase tracking-[0.3em] pt-12 border-t border-stone-200">
          <p>{dict.lastUpdated}</p>
        </div>
      </div>
    </div>
  );
}
