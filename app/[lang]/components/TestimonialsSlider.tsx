'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Quote } from 'lucide-react';

type Testimonial = {
  quote: string;
  name: string;
  meta: string;
};

export default function TestimonialsSlider({ lang }: { lang: string }) {
  const items = useMemo<Testimonial[]>(
    () =>
      lang === 'en'
        ? [
            { quote: 'Great people, great events, and a platform that actually helps.', name: 'Student', meta: 'FAPPZ' },
            { quote: 'I finally have everything in one place: events, info, and contacts.', name: 'Member', meta: 'Pupen' },
            { quote: 'The admin side is fast and clean. Publishing takes minutes.', name: 'Organizer', meta: 'Pupen Control' },
          ]
        : [
            { quote: 'Super lidi, super akce a web, který fakt pomáhá.', name: 'Student', meta: 'FAPPZ' },
            { quote: 'Konečně mám všechno na jednom místě: akce, info i kontakty.', name: 'Člen', meta: 'Pupen' },
            { quote: 'Administrace je rychlá a čistá. Publikování je otázka minut.', name: 'Organizátor', meta: 'Pupen Control' },
          ],
    [lang]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 7000);
    return () => window.clearInterval(t);
  }, [items.length]);

  const item = items[index];

  return (
    <section className="py-20 px-6 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-4">
          {lang === 'en' ? 'Testimonials' : 'Reference'}
        </div>
        <h2 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight">
          {lang === 'en' ? 'What people say' : 'Co o nás říkají'}
        </h2>
      </div>

      <div className="bg-white border border-stone-100 shadow-sm rounded-[3rem] p-10 md:p-16 relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-green-600/5 rounded-full blur-[60px]" />
        <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-green-600/5 rounded-full blur-[60px]" />

        <div className="relative">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shadow-inner mb-8">
            <Quote size={22} />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-stone-800 leading-snug tracking-tight">
            “{item.quote}”
          </p>
          <div className="mt-10 flex items-center justify-between gap-6">
            <div>
              <div className="font-black text-stone-900">{item.name}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{item.meta}</div>
            </div>
            <div className="flex items-center gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-2.5 rounded-full transition ${
                    i === index ? 'w-10 bg-green-600' : 'w-2.5 bg-stone-200 hover:bg-stone-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
