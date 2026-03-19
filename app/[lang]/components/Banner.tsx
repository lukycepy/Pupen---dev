'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Banner({ lang, dict }: { lang: string, dict: any }) {
  const [banner, setBanner] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    async function loadBanner() {
      const { data } = await supabase.from('banners').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) setBanner(data);
    }
    loadBanner();
  }, []);

  // Hide banner in admin and member portal
  const isAppSection = pathname?.includes('/admin') || pathname?.includes('/clen');
  if (isAppSection) return null;

  if (!banner || !isVisible) return null;

  const text = lang === 'en' ? (banner.text_en || banner.text) : banner.text;
  const linkText = lang === 'en' 
    ? (banner.link_text_en || dict?.moreInfo || 'More info') 
    : (banner.link_text || dict?.moreInfo || 'Více info');

  return (
    <div className={`${banner.bg_color || 'bg-green-600'} text-white py-2.5 px-6 relative animate-in slide-in-from-top duration-700 z-[10002] shadow-inner`}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-bold tracking-tight">
        <div 
          className="text-center font-bold banner-rich-text"
          dangerouslySetInnerHTML={{ __html: text }}
        />
        {banner.link_url && (
          <Link href={banner.link_url} className="bg-white text-stone-900 hover:bg-stone-100 px-4 py-1.5 rounded-full flex items-center gap-2 transition-all duration-300 text-[10px] font-black group shadow-lg shadow-black/10 shrink-0">
            {linkText} <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-colors"
        title="Zavřít"
      >
        <X size={14} />
      </button>
    </div>
  );
}
