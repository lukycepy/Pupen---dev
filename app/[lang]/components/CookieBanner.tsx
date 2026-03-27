'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Cookie, ShieldCheck, ArrowRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function CookieBanner({ lang, dict }: { lang: string, dict: any }) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const hide = pathname?.includes('/admin') || pathname?.includes('/clen');

  useEffect(() => {
    if (hide) return;
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [hide]);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    window.dispatchEvent(new Event('cookie-consent-changed'));
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    window.dispatchEvent(new Event('cookie-consent-changed'));
    setIsVisible(false);
  };

  if (hide || !isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-[420px] z-[9999] animate-in slide-in-from-bottom-10 duration-700">
      <div className="bg-white border border-stone-100 shadow-2xl rounded-[2.5rem] p-8 relative overflow-hidden">
        {/* Pozadí efekt */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-50 rounded-full blur-3xl opacity-50" />
        
        <div className="relative">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-green-100 p-3 rounded-2xl text-green-600">
              <Cookie size={28} />
            </div>
            <div>
              <h3 className="font-black text-stone-900 tracking-tight leading-none mb-1">
                {dict.cookies?.title || 'Cookie sušenky'}
              </h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                {dict.cookies?.subtitle || 'Pomozte nám růst'}
              </p>
            </div>
          </div>

          <p className="text-sm text-stone-600 leading-relaxed font-medium mb-8">
            {dict.cookies?.description || 'Používáme cookies, abychom zajistili nejlepší zážitek z našeho webu a pochopili, co vás nejvíce zajímá.'}
          </p>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleAccept}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-green-700 transition-all shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 group"
            >
              {dict.cookies?.acceptAll || 'Přijmout vše'}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="flex gap-2">
              <button 
                onClick={handleDecline}
                className="flex-1 bg-stone-50 text-stone-500 py-3 rounded-xl font-bold text-xs hover:bg-stone-100 transition"
              >
                {dict.cookies?.necessaryOnly || 'Jen nutné'}
              </button>
              <Link 
                href={`/${lang}/ochrana-soukromi`}
                onClick={() => setIsVisible(false)}
                className="flex-1 bg-white border border-stone-100 text-stone-400 py-3 rounded-xl font-bold text-xs hover:text-green-600 hover:border-green-100 transition flex items-center justify-center gap-1.5"
              >
                <ShieldCheck size={14} />
                {dict.cookies?.details || 'Detaily'}
              </Link>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-6 right-6 p-2 text-stone-300 hover:text-stone-900 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
