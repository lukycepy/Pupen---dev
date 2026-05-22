import type { Metadata } from 'next';
import Link from 'next/link';
import { Cookie, ArrowLeft, ShieldCheck, Settings, BarChart3, Eye, Trash2 } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { getSitePageContent } from '@/lib/site/page-content';
import DbContentPage from '@/app/[lang]/components/DbContentPage';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).cookiesPage;
  const title = dict.title;
  const description = dict.intro;
  const canonical = `/${lang}/cookies`;
  const ogImage = '/img/prezentace_pupen.jpg';

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { 'cs-CZ': '/cs/cookies', 'en-US': '/en/cookies' },
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

export default async function CookiesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const page = await getSitePageContent('cookies', lang);
  if (page?.content_html) {
    return <DbContentPage title={page.title || (lang === 'en' ? 'Cookies' : 'Cookies')} html={page.content_html} />;
  }
  const dict = (await getDictionary(lang)).cookiesPage;

  const cookieTypes = [
    {
      icon: ShieldCheck,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-green-100',
      title: dict.necessaryTitle,
      desc: dict.necessaryDesc,
      badge: { text: lang === 'en' ? 'Always active' : 'Vždy aktivní', bg: 'bg-green-100', textColor: 'text-green-700' },
    },
    {
      icon: Settings,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-100',
      title: dict.prefTitle,
      desc: dict.prefDesc,
      badge: { text: lang === 'en' ? 'Optional' : 'Volitelné', bg: 'bg-blue-100', textColor: 'text-blue-700' },
    },
    {
      icon: BarChart3,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-100',
      title: dict.statsTitle,
      desc: dict.statsDesc,
      badge: { text: lang === 'en' ? 'Optional' : 'Volitelné', bg: 'bg-purple-100', textColor: 'text-purple-700' },
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">

      {/* Hero */}
      <header className="relative overflow-hidden bg-stone-900 text-white pt-24 pb-40 px-6">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/60 via-stone-900 to-stone-950" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-stone-400 hover:text-white mb-10 transition font-bold uppercase tracking-widest text-[10px]">
            <ArrowLeft size={16} />
            {dict.backToHome}
          </Link>

          <div className="flex flex-col items-center">
            <div className="bg-amber-500/20 p-5 rounded-[2rem] text-amber-400 mb-8 backdrop-blur-xl border border-amber-500/30">
              <Cookie size={52} />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/30 mb-6">
              <Eye size={12} /> {lang === 'en' ? 'Your privacy' : 'Vaše soukromí'}
            </div>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-6 drop-shadow-2xl">
              {dict.title}
            </h1>
            <p className="text-xl md:text-2xl text-stone-400 font-medium max-w-2xl mx-auto leading-relaxed">
              {dict.intro}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 -mt-24 relative z-20 space-y-8">

        {/* Co jsou cookies */}
        <section className="bg-white rounded-[2.5rem] p-10 md:p-14 shadow-2xl border border-stone-100">
          <div className="flex items-start gap-5 mb-6">
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 shrink-0">
              <Cookie size={28} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-stone-900 mb-2">{dict.whatAreCookiesTitle}</h2>
              <p className="text-stone-400 font-medium text-sm">{lang === 'en' ? 'Basic information' : 'Základní informace'}</p>
            </div>
          </div>
          <div className="p-8 bg-gradient-to-br from-amber-50 to-stone-50 rounded-[2rem] border border-amber-100">
            <p className="text-stone-700 leading-[1.9] text-lg font-medium">{dict.whatAreCookiesText}</p>
          </div>
        </section>

        {/* Typy */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="bg-stone-200 p-2 rounded-xl">
              <Settings size={18} className="text-stone-600" />
            </div>
            <h2 className="text-2xl font-black text-stone-900">{dict.typesTitle}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {cookieTypes.map((ct, i) => (
              <div key={i} className={`bg-white p-8 rounded-[2rem] shadow-lg border ${ct.borderColor} group hover:shadow-xl transition duration-500`}>
                <div className="flex items-start justify-between mb-6">
                  <div className={`${ct.iconBg} p-3 rounded-2xl`}>
                    <ct.icon size={26} className={ct.iconColor} />
                  </div>
                  <span className={`${ct.badge.bg} ${ct.badge.textColor} px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest`}>
                    {ct.badge.text}
                  </span>
                </div>
                <h3 className="text-xl font-black text-stone-900 mb-3">{ct.title}</h3>
                <p className="text-stone-500 font-medium leading-relaxed">{ct.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Jak spravovat */}
        <section className="bg-stone-900 text-white p-10 md:p-16 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-16 opacity-[0.04]">
            <ShieldCheck size={280} />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-start gap-5 mb-8">
              <div className="bg-amber-500/20 p-3 rounded-2xl border border-amber-500/30 shrink-0">
                <Trash2 size={28} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-3xl font-black mb-2">{dict.manageTitle}</h2>
                <p className="text-stone-400 font-medium text-sm">{lang === 'en' ? 'Take control of your data' : 'Mějte kontrolu nad svými daty'}</p>
              </div>
            </div>
            <div className="p-8 bg-white/5 backdrop-blur-sm rounded-[2rem] border border-white/10">
              <p className="text-stone-300 leading-[1.9] text-lg font-medium">{dict.manageText}</p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center text-stone-400 text-[11px] font-black uppercase tracking-[0.3em] pt-16 border-t border-stone-200">
          <p>{dict.lastUpdated}</p>
        </div>
      </div>
    </div>
  );
}
