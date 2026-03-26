'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Users, Heart, Beer, Target, ArrowRight, Linkedin, Instagram, Mail, Phone, Twitter } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { supabase } from '@/lib/supabase';

// --- DATA: Tým (zůstávají v poli, ale texty lze také přeložit v dict) ---
const teamMembers = [
  {
    name: "Barbora Säcklová",
    email: "predsedkyne@pupen.org",
    roleKey: "rolePresident",
    descKey: "descPresident",
    image: "/img/barbora.jpg",
    instagram: "https://www.instagram.com/flu.snow/"
  },
  {
    name: "Karolina Burdová",
    email: "coord@pupen.org",
    roleKey: "roleEvent",
    descKey: "descEvent",
    image: "/img/karolina.jpg",
    instagram: "https://www.instagram.com/karolina_burdova"
  },
  {
    name: "Lukáš Čepelák",
    email: "tech@pupen.org",
    roleKey: "roleTech",
    descKey: "descTech",
    image: "/img/lukas.jpg",
    instagram: "https://www.instagram.com/luky_cepy/"
  }
];

export default function AboutPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [dict, setDict] = useState<any>(null);
  const [heroBg, setHeroBg] = useState('/img/listopad_pupen.jpg');
  const [dynamicTeam, setDynamicTeam] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const d = await getDictionary(lang);
      setDict(d.aboutPage);

      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (data && data.length > 0) {
        setDynamicTeam(data);
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
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      
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
          <div className="absolute inset-0 bg-stone-900/60 mix-blend-multiply" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight">
            {dict.heroTitle} <br />
            <span className="text-green-500">{dict.heroSubtitle}</span>
          </h1>
          <p className="text-xl text-stone-200 leading-relaxed">
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
          <h2 className="text-3xl font-bold mb-4">{dict.valuesTitle}</h2>
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
      <div className="bg-stone-100 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">{dict.teamTitle}</h2>
              <p className="text-stone-600">{dict.teamSubtitle}</p>
            </div>
            <Link href={`/${lang}/kontakt`} className="text-green-600 font-bold hover:text-green-700 flex items-center gap-2">
              {dict.joinUs} <ArrowRight size={20} />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(dynamicTeam.length > 0 ? dynamicTeam : teamMembers).map((member, index) => (
              <div key={member.id || index} className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition duration-300 flex flex-col">
                <div className="h-64 overflow-hidden relative bg-stone-100 flex-shrink-0">
                  {member.image || member.image_url ? (
                    <Image 
                      src={member.image || member.image_url} 
                      alt={member.name} 
                      fill
                      className="object-cover group-hover:scale-110 transition duration-500" 
                      unoptimized={!!member.image_url}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                      <Users size={48} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-4">
                    <div className="flex gap-3 text-white">
                      {member.social_linkedin && (
                        <a href={member.social_linkedin} target="_blank" rel="noopener noreferrer">
                          <Linkedin size={20} className="hover:text-blue-400 cursor-pointer transition-colors" />
                        </a>
                      )}
                      {member.social_twitter && (
                        <a href={member.social_twitter} target="_blank" rel="noopener noreferrer">
                          <Twitter size={20} className="hover:text-sky-400 cursor-pointer transition-colors" />
                        </a>
                      )}
                      {(member.instagram || member.social_instagram) && (
                        <a href={member.instagram || member.social_instagram} target="_blank" rel="noopener noreferrer">
                          <Instagram size={20} className="hover:text-pink-400 cursor-pointer transition-colors" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-5 flex-grow flex flex-col">
                  <h3 className="font-bold text-lg text-stone-900 leading-tight mb-1">{member.name}</h3>
                  <p className="text-green-600 text-xs font-black uppercase tracking-widest mb-3">
                    {member.roleKey ? dict[member.roleKey] : member.role}
                  </p>
                  
                  {member.bio && (
                    <p className="text-sm text-stone-600 mb-4 line-clamp-3">{member.bio}</p>
                  )}

                  <div className="mt-auto pt-4 border-t border-stone-100 flex flex-col gap-2">
                    {member.email && (
                      <a href={`mailto:${member.email}`} className="text-stone-500 hover:text-green-600 transition-colors text-xs font-bold flex items-center gap-2">
                        <Mail size={14} /> {member.email}
                      </a>
                    )}
                    {member.phone && (
                      <a href={`tel:${member.phone}`} className="text-stone-500 hover:text-green-600 transition-colors text-xs font-bold flex items-center gap-2">
                        <Phone size={14} /> {member.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- HISTORIE --- */}
      <div className="py-20 px-6 max-w-6xl mx-auto" id="pribeh">
        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
          <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition duration-500">
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
              <Target className="text-green-600" />
              <span className="font-bold text-stone-500 uppercase tracking-wider text-sm">{dict.storyLabel}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-stone-900">{dict.storyTitle}</h2>
            <div className="space-y-4 text-stone-600 text-lg leading-relaxed">
              <p>{dict.storyP1}</p>
              <p>{dict.storyP2}</p>
              <p>{dict.storyP3}</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{dict.timelineTitle || 'Důležité milníky'}</h2>
            <div className="h-1 w-20 bg-green-600 mx-auto rounded-full"></div>
          </div>
          
          <div className="relative border-l-4 border-green-100 ml-6 md:ml-12 space-y-12 pb-8">
            {dict.timeline?.map((item: any, i: number) => (
              <div key={i} className="relative pl-8 md:pl-12 group">
                <div className="absolute -left-[14px] top-1 w-6 h-6 bg-white border-4 border-green-500 rounded-full group-hover:scale-125 group-hover:bg-green-100 transition duration-300"></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 hover:shadow-lg transition duration-300">
                  <span className="inline-block px-3 py-1 bg-green-50 text-green-700 font-black uppercase tracking-widest text-xs rounded-lg mb-3">
                    {item.year}
                  </span>
                  <h3 className="text-xl font-bold text-stone-900 mb-2">{item.title}</h3>
                  <p className="text-stone-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg shadow-stone-200/50 hover:-translate-y-2 transition duration-300">
      <div className="bg-green-100 w-14 h-14 rounded-full flex items-center justify-center text-green-600 mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-stone-600 leading-relaxed">{desc}</p>
    </div>
  );
}
