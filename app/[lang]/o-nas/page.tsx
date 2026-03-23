'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Users, Heart, Beer, Target, ArrowRight, Linkedin, Instagram } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';

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

  useEffect(() => {
    async function loadData() {
      const d = await getDictionary(lang);
      setDict(d.aboutPage);
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
            style={{ objectPosition: '50% 30%' }}
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member, index) => (
              <div key={index} className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition duration-300">
                <div className="h-64 overflow-hidden relative">
                  <Image 
                    src={member.image} 
                    alt={member.name} 
                    fill
                    className="object-cover group-hover:scale-110 transition duration-500" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-4">
                    <div className="flex gap-3 text-white">
                      <a href={member.instagram} target="_blank" rel="noopener noreferrer">
                        <Instagram size={20} className="hover:text-green-400 cursor-pointer" />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-stone-900">{member.name}</h3>
                  <p className="text-green-600 text-sm font-semibold uppercase tracking-wider mb-3">{dict[member.roleKey]}</p>
                  <a 
                    href={`mailto:${member.email}`} 
                    className="text-stone-500 hover:text-green-600 transition-colors text-sm leading-relaxed"
                  >
                    {member.email}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- HISTORIE --- */}
      <div className="py-20 px-6 max-w-6xl mx-auto" id="pribeh">
        <div className="grid md:grid-cols-2 gap-12 items-center">
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
