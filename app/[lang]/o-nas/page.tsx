'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Users, Heart, Beer, Target, ArrowRight, Linkedin, Instagram, Mail, Phone, Twitter } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { useSitePageContent } from '@/app/[lang]/components/useSitePageContent';

export default function AboutPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const page = useSitePageContent('o-nas', lang);
  const [dict, setDict] = useState<any>(null);
  const [heroBg, setHeroBg] = useState('/img/listopad_pupen.jpg');
  const [dynamicTeam, setDynamicTeam] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const d = await getDictionary(lang);
      setDict(d.aboutPage);

      try {
        const res = await fetch('/api/team', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setDynamicTeam(json?.items || []);
      } catch {
        setDynamicTeam([]);
      }
    }
    loadData();
  }, [lang]);

  useEffect(() => {
    if (dict && window.location.hash === '#pribeh') {
      const element = document.getElementById('pribeh');
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [dict]);

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white font-sans">
      {page.html ? (
        <div className="max-w-6xl mx-auto px-6 pt-24">
          <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-[3rem] p-10 md:p-14">
            {page.title ? <div className="text-3xl md:text-5xl font-black text-black dark:text-white tracking-tight mb-8">{page.title}</div> : null}
            <div className="prose prose-stone dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: page.html }} />
          </div>
        </div>
      ) : null}
      
      {/* --- HERO SECTION --- */}
      <div className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Image 
            src={heroBg}
            alt="Hero background" 
            fill
            priority
            className="object-cover"
            style={{ objectPosition: '50% 22%' }}
            onError={() => setHeroBg('/img/listopad_pupen.jpg')}
          />
          <div className="absolute inset-0 bg-black/60 dark:bg-black/70 mix-blend-multiply" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight">
            {dict.heroTitle} <br />
            <span className="text-green-500">{dict.heroSubtitle}</span>
          </h1>
          <p className="text-xl text-white/80 leading-relaxed">
            {dict.heroDescription}
          </p>
        </div>
      </div>

      {/* --- STATISTIKY --- */}
      <div className="bg-green-600 text-white py-12">
  <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
    {[
      { val: "10+", label: dict.statYears },
      { val: "∞", label: dict.statBeer },
      { val: "100%", label: dict.statLove }
    ].map((stat, i) => (
      <div key={i}>
        <div className="text-4xl font-extrabold mb-1">{stat.val}</div>
        <div className="text-green-100 text-sm font-medium uppercase tracking-wider">
          {stat.label}
        </div>
      </div>
    ))}
  </div>
</div>

      {/* --- HODNOTY --- */}
      <div className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-black dark:text-white">{dict.valuesTitle}</h2>
          <div className="h-1 w-20 bg-green-600 mx-auto rounded-full"></div>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          <ValueCard 
            icon={<Users size={28} />} 
            title={dict.value1Title} 
            desc={dict.value1Desc} 
          />
          <ValueCard 
            icon={<Beer size={28} />} 
            title={dict.value2Title} 
            desc={dict.value2Desc} 
          />
          <ValueCard 
            icon={<Heart size={28} />} 
            title={dict.value3Title} 
            desc={dict.value3Desc} 
          />
        </div>
      </div>

      {/* --- TÝM --- */}
      <div className="bg-white dark:bg-black py-20 px-6 border-t-2 border-b-2 border-black dark:border-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2 text-black dark:text-white">{dict.teamTitle}</h2>
              <p className="text-stone-500 dark:text-stone-400">{dict.teamSubtitle}</p>
            </div>
            <Link href={`/${lang}/kontakt`} className="text-green-600 dark:text-green-500 font-bold hover:text-green-700 dark:hover:text-green-400 flex items-center gap-2">
              {dict.joinUs} <ArrowRight size={20} />
            </Link>
          </div>

          {dynamicTeam.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {dynamicTeam.map((member, index) => (
              <div
                key={member.id || index}
                className="group bg-white dark:bg-black rounded-[2rem] overflow-hidden border-2 border-black dark:border-white hover:border-green-600 dark:hover:border-green-500 transition duration-300 flex flex-col"
              >
                <div className="aspect-square w-full bg-green-50/30 dark:bg-green-950/30 relative flex-shrink-0">
                  {member.image || member.image_url ? (
                    <Image 
                      src={member.image || member.image_url} 
                      alt={member.name} 
                      fill
                      className="object-cover group-hover:scale-110 transition duration-500" 
                      unoptimized={!!member.image_url}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-black dark:text-white/60">
                      <Users size={48} />
                    </div>
                  )}
                </div>
                <div className="p-5 flex-grow flex flex-col">
                  <h3 className="font-bold text-lg text-black dark:text-white leading-tight mb-1">{member.name}</h3>
                  <p className="text-green-600 dark:text-green-500 text-xs font-black uppercase tracking-widest mb-3">
                    {member.role}
                  </p>
                  
                  {member.bio && (
                    <p className="text-sm text-stone-600 dark:text-stone-400 mb-4 line-clamp-3">{member.bio}</p>
                  )}

                  <div className="mt-auto pt-4 border-t border-black/10 dark:border-white/10 flex flex-wrap gap-2">
                    {member.email ? (
                      <a
                        href={`mailto:${member.email}`}
                        className="p-2 bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400 hover:border-green-600 dark:hover:border-green-500 rounded-xl transition"
                        aria-label="E-mail"
                        title={member.email}
                      >
                        <Mail size={16} />
                      </a>
                    ) : null}
                    {member.phone ? (
                      <a
                        href={`tel:${member.phone}`}
                        className="p-2 bg-green-50 dark:bg-green-950 border-2 border-green-600 dark:border-green-500 text-green-700 dark:text-green-400 hover:bg-green-600 hover:text-white dark:hover:bg-green-500 dark:hover:text-black rounded-xl transition"
                        aria-label="Telefon"
                        title={member.phone}
                      >
                        <Phone size={16} />
                      </a>
                    ) : null}
                    {member.social_linkedin ? (
                      <a
                        href={member.social_linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-blue-50 dark:bg-blue-950 border-2 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-black rounded-xl transition"
                        aria-label="LinkedIn"
                      >
                        <Linkedin size={16} />
                      </a>
                    ) : null}
                    {member.social_twitter ? (
                      <a
                        href={member.social_twitter}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-sky-50 dark:bg-sky-950 border-2 border-sky-600 dark:border-sky-500 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-500 dark:hover:text-black rounded-xl transition"
                        aria-label="Twitter"
                      >
                        <Twitter size={16} />
                      </a>
                    ) : null}
                    {(member.instagram || member.social_instagram) ? (
                      <a
                        href={member.instagram || member.social_instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-pink-50 dark:bg-pink-950 border-2 border-pink-600 dark:border-pink-500 text-pink-700 dark:text-pink-400 hover:bg-pink-600 hover:text-white dark:hover:bg-pink-500 dark:hover:text-black rounded-xl transition"
                        aria-label="Instagram"
                      >
                        <Instagram size={16} />
                      </a>
                    ) : null}
                    {member.social_facebook ? (
                      <a
                        href={member.social_facebook}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-blue-50 dark:bg-blue-950 border-2 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-400 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-500 dark:hover:text-black rounded-xl transition"
                        aria-label="Facebook"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* --- HISTORIE --- */}
      <div className="py-20 px-6 max-w-6xl mx-auto bg-white dark:bg-black" id="pribeh">
        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
          <div className="relative h-[400px] rounded-2xl overflow-hidden border-2 border-black dark:border-white rotate-2 hover:rotate-0 transition duration-500">
             <Image 
              src="/img/krava.jpg" 
              alt="Kráva" 
              fill
              className="object-cover"
              style={{ objectPosition: '55% 35%' }}
            />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-green-600 dark:text-green-500" />
              <span className="font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider text-sm">{dict.storyLabel}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-black dark:text-white">{dict.storyTitle}</h2>
            <div className="space-y-4 text-stone-600 dark:text-stone-400 text-lg leading-relaxed">
              <p>{dict.storyP1}</p>
              <p>{dict.storyP3}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white dark:bg-black p-8 rounded-2xl border-2 border-black dark:border-white hover:-translate-y-2 hover:border-green-600 dark:hover:border-green-500 transition duration-300">
      <div className="bg-green-50 dark:bg-green-950 w-14 h-14 rounded-full flex items-center justify-center border-2 border-green-600 dark:border-green-500 text-green-600 dark:text-green-500 mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-black dark:text-white">{title}</h3>
      <p className="text-stone-600 dark:text-stone-400 leading-relaxed">{desc}</p>
    </div>
  );
}
