'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, CheckCircle, Mail } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';

const CATEGORIES = [
  { id: 'all', label: 'Všechny novinky', labelEn: 'All news' },
  { id: 'Párty', label: 'Párty & Zábava', labelEn: 'Parties & Fun' },
  { id: 'Vzdělávání', label: 'Vzdělávání & Přednášky', labelEn: 'Education & Lectures' },
  { id: 'Výlet', label: 'Výlety & Exkurze', labelEn: 'Trips & Excursions' },
];

export default function NewsletterForm({ lang }: { lang: string }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [selectedCats, setSelectedCats] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('newsletter_subscriptions')
        .insert([{ email, categories: selectedCats }]);

      if (error) {
        if (error.code === '23505') {
          showToast(lang === 'cs' ? 'Tento e-mail již odebírá novinky.' : 'This email is already subscribed.', 'error');
        } else {
          throw error;
        }
      } else {
        setSuccess(true);
        showToast(lang === 'cs' ? 'Odběr byl úspěšně nastaven!' : 'Subscription successful!', 'success');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleCat = (id: string) => {
    if (id === 'all') {
      setSelectedCats(['all']);
    } else {
      const filtered = selectedCats.filter(c => c !== 'all');
      if (filtered.includes(id)) {
        const next = filtered.filter(c => c !== id);
        setSelectedCats(next.length === 0 ? ['all'] : next);
      } else {
        setSelectedCats([...filtered, id]);
      }
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-100 p-8 rounded-[2.5rem] text-center animate-in zoom-in duration-500">
        <CheckCircle className="text-green-600 mx-auto mb-4" size={48} />
        <h3 className="text-xl font-bold text-green-900 mb-2">{lang === 'cs' ? 'Vítejte v Pupen komunitě!' : 'Welcome to Pupen community!'}</h3>
        <p className="text-green-700 text-sm">{lang === 'cs' ? 'Brzy vám pošleme první novinky.' : 'We will send you news soon.'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 sm:p-12 rounded-[3rem] border shadow-2xl shadow-green-900/5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
        <Mail size={120} className="text-green-600" />
      </div>
      
      <div className="relative z-10 max-w-xl mx-auto text-center">
        <h3 className="text-2xl sm:text-3xl font-black text-stone-900 mb-4 tracking-tight">
          {lang === 'cs' ? 'Newsletter na míru' : 'Custom Newsletter'}
        </h3>
        <p className="text-stone-500 mb-8 font-medium text-sm sm:text-base">
          {lang === 'cs' ? 'Dostávej jen to, co tě opravdu zajímá. Vyber si kategorie:' : 'Get only what you care about. Pick categories:'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCat(cat.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${selectedCats.includes(cat.id) ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-stone-50 border-stone-100 text-stone-400 hover:border-green-200'}`}
              >
                {lang === 'cs' ? cat.label : cat.labelEn}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              placeholder={lang === 'cs' ? 'Tvůj e-mail...' : 'Your email...'}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-grow px-6 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-green-600 font-bold text-stone-700 shadow-inner"
            />
            <button
              disabled={loading}
              className="bg-stone-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-600 transition shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <InlinePulse className="bg-white/80" size={14} />
              ) : (
                <>
                  <Send
                    size={18}
                    className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                  />{' '}
                  {lang === 'cs' ? 'Odebírat' : 'Subscribe'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
