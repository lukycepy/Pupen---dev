'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function GuidelinesTab({ lang }: { lang: string }) {
  const isEn = lang === 'en';
  return (
    <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm animate-in fade-in duration-500">
      <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
        <ShieldCheck className="text-green-600" />
        {isEn ? 'Community guidelines' : 'Pravidla komunity'}
      </h2>
      <p className="text-stone-500 font-medium mt-3">
        {isEn
          ? 'We want Pupen to be a safe and friendly place.'
          : 'Chceme, aby byl Pupen bezpečné a přátelské místo.'}
      </p>

      <div className="mt-8 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          {[
            {
              title: isEn ? 'Be respectful' : 'Buďte respektující',
              body: isEn
                ? 'No harassment, hate speech or discrimination.'
                : 'Žádné obtěžování, nenávistné projevy ani diskriminace.',
            },
            {
              title: isEn ? 'No spam' : 'Žádný spam',
              body: isEn
                ? 'Do not send unsolicited promotions or repetitive messages.'
                : 'Neposílejte nevyžádané promo ani opakované zprávy.',
            },
            {
              title: isEn ? 'Privacy first' : 'Soukromí na prvním místě',
              body: isEn
                ? 'Do not share personal data without consent.'
                : 'Nesdílejte osobní údaje bez souhlasu.',
            },
            {
              title: isEn ? 'Report issues' : 'Nahlašujte problémy',
              body: isEn
                ? 'Use “Report” if you see problematic behavior.'
                : 'Použijte „Nahlásit“, pokud uvidíte problémové chování.',
            },
          ].map((s) => (
            <div key={s.title} className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
              <div className="text-lg font-black text-stone-900">{s.title}</div>
              <div className="mt-2 text-stone-600 font-medium leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-green-50 border border-green-100 rounded-[2rem] p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-green-700 mb-2">
              {isEn ? 'Moderation' : 'Moderace'}
            </div>
            <div className="text-sm font-bold text-green-800 leading-relaxed">
              {isEn
                ? 'Reports are reviewed by admins. Repeated violations may lead to limited access.'
                : 'Nahlášení kontrolují admini. Opakované porušení může vést k omezení přístupu.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

