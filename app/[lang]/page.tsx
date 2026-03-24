'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { 
  Leaf, Calendar, Users, ArrowRight, Beer, GraduationCap, 
  HeartHandshake, HelpCircle, ChevronDown, ChevronUp, ExternalLink, 
  Archive, Map as MapIcon, BookOpen, UserPlus as UserPlusIcon, Image as ImageIcon
} from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import CountdownWidget from './components/CountdownWidget';
import NewsletterForm from '../components/NewsletterForm';
import TestimonialsSlider from './components/TestimonialsSlider';
import InstagramFeedGrid from './components/InstagramFeedGrid';

const PollComponent = dynamic(() => import('./components/PollComponent'), {
  loading: () => <div className="h-48 bg-white rounded-[2.5rem] animate-pulse border border-stone-100 shadow-sm" />,
  ssr: false
});

export default function PupenWeb() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [dict, setDict] = useState<any>(null);
  const [homeCfg, setHomeCfg] = useState<any>(null);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [nextEvent, setNextEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [heroBg, setHeroBg] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const d = await getDictionary(lang);
        setDict(d.homePage);

        const today = new Date().toISOString().split('T')[0];
        const nowIso = new Date().toISOString();
        const [cfgRes, faqRes, partnerRes, postsRes, nextEventRes] = await Promise.all([
          fetch('/api/site-config', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
          supabase.from('faqs').select('*').order('sort_order', { ascending: true }),
          supabase.from('partners').select('*').order('sort_order', { ascending: true }),
          supabase
            .from('posts')
            .select('*')
            .not('published_at', 'is', null)
            .lte('published_at', nowIso)
            .order('published_at', { ascending: false })
            .limit(2),
          supabase
            .from('events')
            .select('*')
            .not('published_at', 'is', null)
            .lte('published_at', nowIso)
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        setHomeCfg(cfgRes?.config?.home || null);
        setFaqs(faqRes.data || []);
        setPartners(partnerRes.data || []);
        setPosts(postsRes.data || []);
        setNextEvent(nextEventRes.data || null);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [lang]);

  const toggleFaq = (id: string) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  if (!dict) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-green-100 selection:text-green-900">
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-28">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-stone-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-stone-100">
            <Leaf size={12} className="text-green-600" /> Pupen
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-black tracking-tight">
            {lang === 'en' ? 'Studentský spolek Pupen, z.s.' : 'Studentský spolek Pupen, z.s.'}
          </h1>
          <p className="mt-4 text-stone-600 font-medium leading-relaxed max-w-3xl">
            {lang === 'en'
              ? 'We connect students, science and fun at our faculty. This website provides public information and member features.'
              : 'Propojujeme studenty, vědu a zábavu na naší fakultě. Web obsahuje veřejné informace a členské funkce.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-stone-600">
            <Link href={`/${lang}/ochrana-soukromi`} className="hover:text-green-700 underline underline-offset-4 decoration-green-200">
              {lang === 'en' ? 'Privacy policy' : 'Ochrana soukromí'}
            </Link>
            <span className="text-stone-300">•</span>
            <Link href={`/${lang}/tos`} className="hover:text-green-700 underline underline-offset-4 decoration-green-200">
              {lang === 'en' ? 'Terms of service' : 'Obchodní podmínky'}
            </Link>
            <span className="text-stone-300">•</span>
            <Link href={`/${lang}/login`} className="hover:text-green-700 underline underline-offset-4 decoration-green-200">
              {lang === 'en' ? 'Member login' : 'Přihlášení členů'}
            </Link>
          </div>
          <div className="mt-10 h-10 w-64 bg-white rounded-2xl border border-stone-100 animate-pulse" />
        </div>
      </div>
    );
  }

  const widgets = (homeCfg?.widgets && typeof homeCfg.widgets === 'object' ? homeCfg.widgets : {}) as any;
  const heroBgUrl =
    Array.isArray(homeCfg?.hero?.backgrounds) && homeCfg.hero.backgrounds.length > 0
      ? String(homeCfg.hero.backgrounds[0])
      : '/img/prezentace_pupen.jpg';

  useEffect(() => {
    setHeroBg(heroBgUrl);
  }, [heroBgUrl]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-green-100 selection:text-green-900">
      
      {/* --- 1. HERO SECTION --- */}
      {widgets.hero !== false && (
      <header className="relative min-h-[70vh] sm:min-h-[85vh] lg:min-h-[90vh] flex items-center justify-center text-center px-4 overflow-visible bg-stone-900">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-stone-900/40 z-10" />
          <Image 
            src={heroBg || '/img/prezentace_pupen.jpg'} 
            alt="Students" 
            fill
            priority
            sizes="100vw"
            className="object-cover"
            onError={() => setHeroBg('/img/prezentace_pupen.jpg')}
          />
        </div>
        
        <div className="relative z-20 w-full max-w-5xl mx-auto -mt-10 sm:-mt-20">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold mb-4 leading-tight tracking-tighter text-white drop-shadow-2xl px-2">
            {dict.heroTitleStart} <span className="text-green-400">{dict.heroTitleGreen}</span>.
          </h1>
          <p className="text-sm sm:text-xl lg:text-2xl mb-8 text-stone-100/90 max-w-2xl mx-auto font-medium px-6">
            {dict.heroSub}
          </p>
        </div>
      </header>
      )}

      {/* --- 2. RYCHLÝ PŘEHLED --- */}
      <section className="relative z-40 px-4 sm:px-6 max-w-6xl mx-auto -mt-24 sm:-mt-34">
        {widgets.countdown !== false && nextEvent && (
          <div className="mb-8">
            <CountdownWidget 
              targetDate={`${nextEvent.date}T${nextEvent.time}`} 
              title={nextEvent.title} 
              lang={lang} 
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {[
            { Icon: Users, title: dict.feat1Title, text: dict.feat1Text },
            { Icon: Calendar, title: dict.feat2Title, text: dict.feat2Text },
            { Icon: Leaf, title: dict.feat3Title, text: dict.feat3Text }
          ].map((item, i) => (
            <div 
              key={i} 
              className="group relative bg-white rounded-[2rem] p-8 text-center transition-all duration-500 hover:-translate-y-3 border border-stone-100 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-50/0 to-green-50/0 group-hover:from-green-50/50 group-hover:to-white transition-all duration-500 rounded-[2rem]" />
              <div className="relative z-10">
                <div className="w-14 h-14 mx-auto bg-stone-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-green-600 transition-all duration-500 shadow-sm group-hover:shadow-green-200 group-hover:shadow-lg">
                  <item.Icon className="w-7 h-7 text-green-600 group-hover:text-white transition-colors duration-500" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-stone-900 tracking-tight">{item.title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed px-2">{item.text}</p>
                <div className="w-0 h-1 bg-green-500 mx-auto mt-6 rounded-full group-hover:w-12 transition-all duration-500" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- 3. O NÁS --- */}
      <section className="py-20 sm:py-16 px-6 max-w-6xl mx-auto overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="order-2 lg:order-1">
            <span className="text-green-600 font-bold uppercase tracking-widest text-xs sm:text-sm mb-3 block">{dict.aboutBadge}</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 mb-6 leading-tight">
              {dict.aboutTitleStart} <span className="text-green-600 underline decoration-4 decoration-green-200">{dict.aboutTitleUnderline}</span>.
            </h2>
            <div className="space-y-5 text-base sm:text-lg text-stone-600 leading-relaxed">
              <p>{dict.aboutP1}</p>
              <p>{dict.aboutP2}</p>
            </div>
            <div className="mt-10">
              <Link href={`/${lang}/o-nas#pribeh`} className="inline-flex items-center gap-2 text-lg font-bold text-green-700 hover:text-green-800 transition-colors group">
                {dict.aboutLink} <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </Link>
            </div>
          </div>
          <div className="relative order-1 lg:order-2 px-4 sm:px-0">
            <div className="absolute -inset-4 bg-green-100 rounded-3xl rotate-2 -z-10 hidden sm:block"></div>
            <Image 
              src="/img/listopad_pupen.jpg" 
              alt="Pupen" 
              width={800}
              height={550}
              className="rounded-2xl shadow-2xl w-full aspect-[4/3] lg:aspect-auto object-cover h-auto lg:h-[550px]"
              style={{ objectPosition: '50% 25%' }}
            />
          </div>
        </div>
      </section>

      {/* --- 4. NOVINKY A ANKETA --- */}
      <section className="py-20 sm:py-32 px-6 max-w-6xl mx-auto overflow-hidden">
        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <header className="flex items-center justify-between mb-12">
              <h2 className="text-3xl sm:text-5xl font-black text-stone-900 tracking-tighter leading-none">
                {dict.newsTitle}
              </h2>
              <Link href={`/${lang}/novinky`} className="hidden sm:flex items-center gap-2 text-green-600 font-bold hover:gap-3 transition-all">
                {dict.allNews} <ArrowRight size={20} />
              </Link>
            </header>
            
            <div className="grid sm:grid-cols-2 gap-8">
               {posts.length > 0 ? (
                 posts.map((post) => (
                   <article key={post.id} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-500 group">
                      <div className="h-48 bg-stone-100 rounded-[2rem] mb-6 overflow-hidden relative">
                         {post.image_url ? (
                           <Image src={post.image_url} alt={post.title} fill className="object-cover group-hover:scale-105 transition duration-500" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-stone-50 text-stone-300">
                             <ImageIcon size={48} />
                           </div>
                         )}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2 block">
                        {post.category || (lang === 'en' ? 'News' : 'Novinka')} • {new Date(post.created_at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US')}
                      </span>
                      <h3 className="text-xl font-bold text-stone-900 mb-4 group-hover:text-green-600 transition-colors line-clamp-2">
                        {lang === 'en' && post.title_en ? post.title_en : post.title}
                      </h3>
                      <p className="text-stone-500 text-sm mb-6 line-clamp-2">
                        {lang === 'en' && post.excerpt_en ? post.excerpt_en : post.excerpt}
                      </p>
                      <Link href={`/${lang}/novinky/${post.id}`} className="inline-flex items-center gap-2 text-stone-900 font-black uppercase tracking-widest text-[10px] hover:text-green-600 transition">
                         {dict.readMore} <ArrowRight size={14} />
                      </Link>
                   </article>
                 ))
               ) : loading ? (
                 [1, 2].map((i) => (
                   <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm animate-pulse">
                     <div className="h-48 bg-stone-100 rounded-[2rem] mb-6" />
                     <div className="h-4 w-24 bg-stone-100 rounded mb-4" />
                     <div className="h-6 w-full bg-stone-100 rounded mb-4" />
                     <div className="h-12 w-full bg-stone-100 rounded" />
                   </div>
                 ))
               ) : (
                 <div className="col-span-2 py-12 text-center text-stone-400 font-medium">
                   {dict.newsEmpty}
                 </div>
               )}
            </div>
          </div>

          <div className="space-y-8">
            <PollComponent lang={lang} />
            
            <div className="bg-stone-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 text-white/5 opacity-20 group-hover:opacity-40 transition-opacity">
                  <UserPlusIcon size={120} />
               </div>
               <h3 className="text-2xl font-black mb-4 leading-tight relative z-10">{dict.ctaJoinTitle}</h3>
               <p className="text-stone-400 text-sm mb-8 relative z-10 leading-relaxed">{dict.ctaJoinSub}</p>
               <Link href={`/${lang}/kontakt`} className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition relative z-10 shadow-lg shadow-green-900/50">
                  {dict.ctaJoinBtn} <ArrowRight size={16} />
               </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- 4.5 RYCHLÉ ODKAZY --- */}
      <section className="py-20 bg-stone-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <Link href={`/${lang}/archiv`} className="bg-white p-8 rounded-[2rem] flex flex-col items-center text-center group hover:bg-green-600 transition-colors duration-500 shadow-sm hover:shadow-xl hover:shadow-green-100">
               <div className="p-4 bg-stone-50 text-green-600 rounded-2xl mb-4 group-hover:bg-white/20 group-hover:text-white transition-colors"><Archive size={32} /></div>
               <span className="font-black text-stone-900 group-hover:text-white transition-colors uppercase tracking-widest text-xs">{dict.archiveAktivit}</span>
            </Link>
            <Link href={`/${lang}/mapa`} className="bg-white p-8 rounded-[2rem] flex flex-col items-center text-center group hover:bg-green-600 transition-colors duration-500 shadow-sm hover:shadow-xl hover:shadow-green-100">
               <div className="p-4 bg-stone-50 text-green-600 rounded-2xl mb-4 group-hover:bg-white/20 group-hover:text-white transition-colors"><MapIcon size={32} /></div>
               <span className="font-black text-stone-900 group-hover:text-white transition-colors uppercase tracking-widest text-xs">{dict.mapaAreálu}</span>
            </Link>
            <Link href={`/${lang}/burza`} className="bg-white p-8 rounded-[2rem] flex flex-col items-center text-center group hover:bg-green-600 transition-colors duration-500 shadow-sm hover:shadow-xl hover:shadow-green-100">
               <div className="p-4 bg-stone-50 text-green-600 rounded-2xl mb-4 group-hover:bg-white/20 group-hover:text-white transition-colors"><BookOpen size={32} /></div>
               <span className="font-black text-stone-900 group-hover:text-white transition-colors uppercase tracking-widest text-xs">{dict.burzaUčebnic}</span>
            </Link>
            <Link href={`/${lang}/galerie`} className="bg-white p-8 rounded-[2rem] flex flex-col items-center text-center group hover:bg-green-600 transition-colors duration-500 shadow-sm hover:shadow-xl hover:shadow-green-100">
               <div className="p-4 bg-stone-50 text-green-600 rounded-2xl mb-4 group-hover:bg-white/20 group-hover:text-white transition-colors"><ImageIcon size={32} /></div>
               <span className="font-black text-stone-900 group-hover:text-white transition-colors uppercase tracking-widest text-xs">{dict.fotogalerie}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* --- 5. FAQ --- */}
      {faqs.length > 0 && (
        <section className="py-20 sm:py-32 px-6 max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 sm:mb-16 flex items-center justify-center gap-3 text-stone-900">
            <HelpCircle className="text-green-600 flex-shrink-0" /> {dict.faqTitle}
          </h2>
          
          <div className="space-y-4">
            {faqs.map((faq) => {
              const isOpen = openFaq === faq.id;
              const question = lang === 'en' && faq.question_en ? faq.question_en : faq.question;
              const answer = lang === 'en' && faq.answer_en ? faq.answer_en : faq.answer;
              return (
                <div key={faq.id} className={`bg-white border rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-green-500 shadow-xl' : 'border-stone-200'}`}>
                  <button onClick={() => toggleFaq(faq.id)} className="w-full flex justify-between items-center p-5 sm:p-6 text-left font-bold text-stone-900 hover:bg-stone-50 transition-colors">
                    <span className="text-base sm:text-lg pr-6">{question}</span>
                    <div className="flex-shrink-0">{isOpen ? <ChevronUp className="text-green-600" /> : <ChevronDown className="text-stone-400" />}</div>
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="p-5 sm:p-6 pt-0 text-stone-600 leading-relaxed border-t border-stone-50 text-sm sm:text-base whitespace-pre-wrap">
                        {answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {widgets.testimonials !== false && <TestimonialsSlider lang={lang} />}
      {widgets.instagram !== false && (
        <InstagramFeedGrid url={homeCfg?.instagram?.url} handle={homeCfg?.instagram?.handle} />
      )}

      {/* --- 5.5 PARTNEŘI --- */}
      {widgets.partners !== false && partners.length > 0 && (
        <section className="py-20 bg-white border-y border-stone-100">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-12">Spolupracujeme s</h2>
            {partners.length > 5 ? (
              <div className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white to-transparent z-10" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-transparent z-10" />
                <div className="partner-marquee flex items-center gap-16 md:gap-24 w-max">
                  {[...partners, ...partners].map((p, i) => (
                    <a
                      key={`${p.id}-${i}`}
                      href={p.link_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition duration-500 hover:brightness-110"
                    >
                      {p.logo_url ? (
                        <div className="relative w-32 h-16">
                          <Image src={p.logo_url} alt={p.name} fill className="object-contain" />
                        </div>
                      ) : (
                        <span className="font-black text-xl text-stone-300 group-hover:text-green-600 transition">{p.name}</span>
                      )}
                      {p.link_url && (
                        <ExternalLink
                          size={10}
                          className="absolute -top-2 -right-4 text-stone-300 opacity-0 group-hover:opacity-100 transition"
                        />
                      )}
                    </a>
                  ))}
                </div>
                <style jsx>{`
                  .partner-marquee {
                    animation: partner-marquee 26s linear infinite;
                  }
                  @keyframes partner-marquee {
                    0% {
                      transform: translateX(0);
                    }
                    100% {
                      transform: translateX(-50%);
                    }
                  }
                `}</style>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20">
                {partners.map((p) => (
                  <a
                    key={p.id}
                    href={p.link_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition duration-500 hover:brightness-110"
                  >
                    {p.logo_url ? (
                      <div className="relative w-32 h-16">
                        <Image src={p.logo_url} alt={p.name} fill className="object-contain" />
                      </div>
                    ) : (
                      <span className="font-black text-xl text-stone-300 group-hover:text-green-600 transition">{p.name}</span>
                    )}
                    {p.link_url && (
                      <ExternalLink
                        size={10}
                        className="absolute -top-2 -right-4 text-stone-300 opacity-0 group-hover:opacity-100 transition"
                      />
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* --- 5.6 NEWSLETTER --- */}
      {widgets.newsletter !== false && (
        <section className="py-20 px-6 max-w-4xl mx-auto">
          <NewsletterForm lang={lang} />
        </section>
      )}

      {/* --- 6. CTA --- */}
      {widgets.cta !== false && (
      <section className="py-24 sm:py-32 px-6 text-center bg-stone-50 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <span className="block text-green-600 font-bold uppercase tracking-widest text-xs sm:text-sm mb-4">
            {dict.ctaBadge}
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-stone-900 mb-8 leading-tight tracking-tight">
            {dict.ctaTitle}
          </h2>
          <p className="text-stone-600 text-base sm:text-xl mb-12 leading-relaxed max-w-2xl mx-auto px-4 font-light">
            {dict.ctaSub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-6">
            <Link 
              href={`/${lang}/kontakt`} 
              className="bg-green-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-900/20 flex items-center justify-center gap-2 group hover:scale-105 active:scale-95 w-full sm:w-auto"
            >
              {dict.ctaBtnJoin} <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            <Link 
              href={`/${lang}/akce`} 
              className="bg-white border-2 border-stone-200 text-stone-700 px-10 py-4 rounded-xl font-bold hover:border-green-600 hover:text-green-600 transition-all flex items-center justify-center hover:scale-105 active:scale-95 w-full sm:w-auto shadow-sm"
            >
              {dict.ctaBtnEvents}
            </Link>
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
