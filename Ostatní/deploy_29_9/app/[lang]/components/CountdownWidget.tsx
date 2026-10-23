'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownWidgetProps {
  targetDate: string; // ISO string
  title: string;
  lang: string;
  showPrefix?: boolean;
}

export default function CountdownWidget({ targetDate, title, lang, showPrefix = true }: CountdownWidgetProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const difference = +new Date(targetDate) - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft(null);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) return null;

  const labels = {
    cs: { days: 'Dní', hours: 'Hod', minutes: 'Min', seconds: 'Sek' },
    en: { days: 'Days', hours: 'Hrs', minutes: 'Min', seconds: 'Sec' }
  }[lang as 'cs' | 'en'] || { days: 'Dní', hours: 'Hod', minutes: 'Min', seconds: 'Sek' };

  return (
    <div className="bg-green-600 text-white p-6 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
          <Clock className="animate-pulse" size={24} />
        </div>
        <div>
          {showPrefix ? (
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{lang === 'cs' ? 'Blíží se' : 'Upcoming'}</p>
          ) : null}
          <h3 className="text-xl font-bold leading-none">{title}</h3>
        </div>
      </div>

      <div className="flex gap-4">
        {[
          { value: timeLeft.days, label: labels.days },
          { value: timeLeft.hours, label: labels.hours },
          { value: timeLeft.minutes, label: labels.minutes },
          { value: timeLeft.seconds, label: labels.seconds },
        ].map((unit, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className="w-14 h-14 bg-white text-green-600 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
              {unit.value.toString().padStart(2, '0')}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-80">{unit.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
