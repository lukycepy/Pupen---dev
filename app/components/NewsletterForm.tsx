'use client';

import React, { useState } from 'react';
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
  const [honeyPot, setHoneyPot] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          categories: selectedCats, 
          source: 'web',
          hp: honeyPot
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');

      setSuccess(true);
      showToast(lang === 'cs' ? 'Odběr byl úspěšně nastaven!' : 'Subscription successful!', 'success');
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
      <div className="bg-green-50 dark:bg-green-950 border-2 border-green-600 dark:border-green-400 p-8 rounded-[2.5rem] text-center animate-in zoom-in duration-500">
        <CheckCircle className="text-green-600 dark:text-green-400 mx-auto mb-4" size={48} />
        <h3 className="text-xl font-bold text-black dark:text-white mb-2">{lang === 'cs' ? 'Vítejte v Pupen komunitě!' : 'Welcome to Pupen community!'}</h3>
        <p className="text-stone-500 dark:text-stone-400 text-sm">{lang === 'cs' ? 'Brzy vám pošleme první novinky.' : 'We will send you news soon.'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-black p-8 sm:p-12 rounded-[3rem] border-2 border-black dark:border-white relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
        <Mail size={120} className="text-green-600 dark:text-green-400" />
      </div>
      
      <div className="relative z-10 max-w-xl mx-auto text-center">
        <h3 className="text-2xl sm:text-3xl font-black text-black dark:text-white mb-4 tracking-tight">
          {lang === 'cs' ? 'Newsletter na míru' : 'Custom Newsletter'}
        </h3>
        <p className="text-stone-500 dark:text-stone-400 mb-8 font-medium text-sm sm:text-base">
          {lang === 'cs' ? 'Dostávej jen to, co tě opravdu zajímá. Vyber si kategorie:' : 'Get only what you care about. Pick categories:'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            name="hp"
            value={honeyPot}
            onChange={(e) => setHoneyPot(e.target.value)}
            className="opacity-0 absolute -z-10 w-0 h-0"
            tabIndex={-1}
            autoComplete="off"
          />
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCat(cat.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${selectedCats.includes(cat.id) ? 'bg-green-600 dark:bg-green-500 border-green-600 dark:border-green-500 text-white' : 'bg-white dark:bg-black border-black dark:border-white text-black dark:text-white hover:border-green-600 dark:hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'}`}
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
              className="flex-grow px-6 py-4 rounded-2xl bg-white dark:bg-black border-2 border-black dark:border-white focus:ring-2 focus:ring-green-500 font-bold text-black dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none"
            />
            <button
              disabled={loading}
              className="bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-600 dark:hover:bg-green-500 hover:text-white dark:hover:text-white transition border-2 border-black dark:border-white hover:border-green-600 dark:hover:border-green-500 disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <InlinePulse className="bg-white/80 dark:bg-black/80" size={14} />
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
