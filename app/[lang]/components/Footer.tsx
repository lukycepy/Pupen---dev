'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf, Instagram, Facebook, Mail, MapPin, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';

interface FooterProps {
  lang: string;
  dict: any;
}

export default function Footer({ lang, dict }: FooterProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const pathname = usePathname();

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setStatus('idle');

    try {
      const { error } = await supabase
        .from('newsletter_subscriptions')
        .insert([{ email, categories: ['all'] }]);

      if (error) {
        if (error.code === '23505') {
          setStatus('success');
          setEmail('');
          setTimeout(() => setStatus('idle'), 5000);
          return;
        }
        throw error;
      }
      
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 5000);
    } catch (err: any) {
      console.error('Newsletter subscription error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint
      });
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const isAppSection = pathname?.includes('/admin') || pathname?.includes('/clen');

  return (
    <footer className={`bg-stone-900 text-stone-300 py-16 border-t border-stone-800 font-sans ${isAppSection ? 'lg:pl-72' : ''}`}>
      <div className="max-w-7xl mx-auto px-6">
        
        {/* HORNÍ ČÁST FOOTERU */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          {/* 1. Sloupec: Značka a popis */}
          <div className="lg:col-span-1">
            <Link href={`/${lang}`} className="flex items-center gap-3 text-white mb-6 group w-fit">
              <div className="bg-stone-800 p-2.5 rounded-xl group-hover:bg-green-600 transition-all duration-300 shadow-lg">
                <Leaf className="text-green-500 w-5 h-5 group-hover:text-white transition-colors" />
              </div>
              <span className="font-black text-xl tracking-tight">Pupen</span>
            </Link>
            <p className="text-sm leading-relaxed mb-6 text-stone-400">
              {dict.description}
            </p>
          </div>

          {/* 2. Sloupec: Rychlé odkazy */}
          <div>
            <h3 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">{dict.menuTitle}</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href={`/${lang}`} className="hover:text-green-500 transition duration-300 flex items-center gap-2">
                  {dict.home}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/akce`} className="hover:text-green-500 transition duration-300 flex items-center gap-2">
                  {dict.events}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/o-nas`} className="hover:text-green-500 transition duration-300 flex items-center gap-2">
                  {dict.about}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/kontakt`} className="hover:text-green-500 transition duration-300 flex items-center gap-2">
                  {dict.contact}
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. Sloupec: Kontakt */}
          <div>
            <h3 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">{dict.findUs}</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3 text-stone-400">
                <MapPin className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <span className="text-sm whitespace-pre-line">
                  {dict.address}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-green-600 shrink-0" />
                <a href={`mailto:${dict.contactEmail}`} className="hover:text-white transition text-sm">
                  {dict.contactEmail}
                </a>
              </li>
            </ul>
          </div>

          {/* 4. Sloupec: Newsletter */}
          <div>
            <h3 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">{dict.newsletterTitle}</h3>
            <p className="text-sm mb-4">{dict.newsletterText}</p>
            
            <form onSubmit={handleSubscribe} className="relative mb-8">
              <div className="flex gap-2">
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lang === 'cs' ? 'Tvůj e-mail' : 'Your email'} 
                  className="bg-stone-800 text-white text-sm px-4 py-3 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-green-600 border border-stone-700 placeholder-stone-500 transition-all"
                />
                <button 
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 text-white p-3 rounded-xl hover:bg-green-500 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                >
                  {loading ? <InlinePulse className="bg-white/80" size={14} /> : <ArrowRight size={20} />}
                </button>
              </div>

              {status === 'success' && (
                <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-green-500 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                  <CheckCircle size={14} /> {lang === 'cs' ? 'Přihlášeno! Díky.' : 'Subscribed! Thanks.'}
                </div>
              )}
              {status === 'error' && (
                <div className="absolute top-full left-0 mt-2 text-red-500 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                  {lang === 'cs' ? 'Chyba. Zkus to později.' : 'Error. Try again later.'}
                </div>
              )}
            </form>

            <div className="flex gap-4">
              <a href="https://instagram.com/pupenfappz/" target="_blank" className="bg-stone-800 p-2.5 rounded-full hover:bg-green-600 hover:text-white transition duration-300">
                <Instagram size={20} />
              </a>
              <a href="https://facebook.com/pupenfappz/" target="_blank" className="bg-stone-800 p-2.5 rounded-full hover:bg-green-600 hover:text-white transition duration-300">
                <Facebook size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* SPODNÍ ČÁST FOOTERU */}
        <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p>© {new Date().getFullYear()} Studentský spolek Pupen, z.s. {dict.rights}</p>
          <div className="flex gap-6">
            <Link href={`/${lang}/ochrana-soukromi`} className="hover:text-white transition">{dict.privacy}</Link>
            <Link href={`/${lang}/tos`} className="hover:text-white transition">{dict.tos}</Link>
            <Link href={`/${lang}/cookies`} className="hover:text-white transition">{dict.cookies}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
