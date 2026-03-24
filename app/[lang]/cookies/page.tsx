import Link from 'next/link';
import { Cookie, ArrowLeft, Info, Settings, ShieldCheck, BarChart3 } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';

export default async function CookiesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const dict = (await getDictionary(lang)).cookiesPage;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-32">
      
      {/* Hero Header */}
      <header className="relative pt-32 pb-24 px-6 overflow-hidden bg-stone-900 text-white">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-stone-900 z-10" />
          <div className="absolute top-[-10%] -left-20 w-[40rem] h-[40rem] bg-amber-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] -right-20 w-[40rem] h-[40rem] bg-amber-600/10 rounded-full blur-[120px]" />
        </div>
        
        <div className="max-w-4xl mx-auto relative z-20 text-center">
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-10 transition font-black uppercase tracking-[0.2em] text-[10px]">
            <ArrowLeft size={16} />
            {dict.backToHome}
          </Link>
          
          <div className="flex flex-col items-center">
            <div className="bg-amber-500/20 p-5 rounded-[2rem] text-amber-400 mb-8 backdrop-blur-xl border border-amber-500/30">
              <Cookie size={48} />
            </div>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-8 drop-shadow-2xl">
              {dict.title}
            </h1>
            <p className="text-xl md:text-2xl text-stone-300 font-medium max-w-2xl mx-auto leading-relaxed">
              {dict.intro}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 -mt-12 relative z-30">
        <div className="space-y-12">
          {/* CO JSOU COOKIES */}
          <section className="bg-white p-10 md:p-16 rounded-[3rem] shadow-2xl shadow-stone-200/50 border border-stone-100">
            <h2 className="text-3xl font-black mb-8 flex items-center gap-4 tracking-tight">
              <span className="bg-amber-100 p-2.5 rounded-2xl text-amber-600"><Info size={28} /></span>
              {dict.whatAreCookiesTitle}
            </h2>
            <div className="text-stone-600 leading-[1.8] text-lg font-medium">
              {dict.whatAreCookiesText}
            </div>
          </section>

          {/* TYPY COOKIES */}
          <section>
            <h2 className="text-3xl font-black mb-8 flex items-center gap-4 tracking-tight px-4">
              <span className="bg-amber-100 p-2.5 rounded-2xl text-amber-600"><Settings size={28} /></span>
              {dict.typesTitle}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-stone-50 group hover:border-amber-100 transition duration-500">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition duration-500">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="text-xl font-black text-stone-900 mb-3">{dict.necessaryTitle}</h3>
                <p className="text-stone-500 font-medium leading-relaxed">{dict.necessaryDesc}</p>
              </div>
              
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-stone-50 group hover:border-amber-100 transition duration-500">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition duration-500">
                  <Settings size={24} />
                </div>
                <h3 className="text-xl font-black text-stone-900 mb-3">{dict.prefTitle}</h3>
                <p className="text-stone-500 font-medium leading-relaxed">{dict.prefDesc}</p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-stone-50 group hover:border-amber-100 transition duration-500">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition duration-500">
                  <BarChart3 size={24} />
                </div>
                <h3 className="text-xl font-black text-stone-900 mb-3">{dict.statsTitle}</h3>
                <p className="text-stone-500 font-medium leading-relaxed">{dict.statsDesc}</p>
              </div>
            </div>
          </section>

          {/* JAK ZMĚNIT NASTAVENÍ */}
          <section className="bg-stone-900 text-white p-10 md:p-16 rounded-[4rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition duration-1000">
              <ShieldCheck size={240} />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-3xl font-black mb-8 flex items-center gap-4 tracking-tight">
                <span className="bg-amber-500/20 p-2.5 rounded-2xl text-amber-400"><ShieldCheck size={28} /></span>
                {dict.manageTitle}
              </h2>
              <p className="text-stone-300 leading-relaxed text-lg font-medium">{dict.manageText}</p>
            </div>
          </section>
        </div>

        {/* Patička */}
        <div className="text-center text-stone-400 text-[11px] font-black uppercase tracking-[0.3em] mt-24 pt-12 border-t border-stone-200">
          <p>{dict.lastUpdated}</p>
        </div>
      </main>
    </div>
  );
}
