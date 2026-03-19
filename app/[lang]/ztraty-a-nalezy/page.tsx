'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { KeyRound, MapPin, Phone, ShieldCheck, Search } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';

type Item = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  contact: string | null;
  status: string;
};

export default function LostFoundPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'returned'>('open');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const url = new URL('/api/lost-found', window.location.origin);
        url.searchParams.set('limit', '50');
        if (status !== 'all') url.searchParams.set('status', status);
        const res = await fetch(url.toString());
        const json = await res.json().catch(() => ({}));
        if (mounted) setItems((json?.items || []) as Item[]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [status]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => {
      const hay = `${i.title} ${i.description || ''} ${i.category || ''} ${i.location || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <KeyRound className="text-green-600" />
              {lang === 'en' ? 'Lost & Found' : 'Ztráty a nálezy'}
            </h1>
            <p className="text-stone-500 font-medium mt-2">
              {lang === 'en'
                ? 'A quick feed for lost ISIC, keys, and other items.'
                : 'Rychlý feed pro ztracený ISIC, klíče a další věci.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={lang === 'en' ? 'Search...' : 'Hledat...'}
                className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-stone-50 border-none rounded-2xl px-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
            >
              <option value="open">{lang === 'en' ? 'Open' : 'Aktivní'}</option>
              <option value="returned">{lang === 'en' ? 'Returned' : 'Vráceno'}</option>
              <option value="all">{lang === 'en' ? 'All' : 'Vše'}</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <InlinePulse className="bg-stone-200" size={20} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-[3rem] border border-dashed border-stone-200 p-16 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center mb-4">
            <ShieldCheck className="text-stone-400" size={26} />
          </div>
          <div className="font-black text-stone-900">{lang === 'en' ? 'No items yet' : 'Zatím nic'}</div>
          <div className="text-stone-400 font-medium mt-2">
            {lang === 'en'
              ? 'Admins can add items in Pupen Control.'
              : 'Admini mohou přidávat položky v Pupen Control.'}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filtered.map((i) => (
            <div key={i.id} className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-black text-stone-900 text-lg truncate">{i.title}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                    {new Date(i.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                    {i.category ? ` • ${i.category}` : ''}
                    {i.status ? ` • ${i.status}` : ''}
                  </div>
                </div>
              </div>
              {i.description ? <div className="mt-4 text-stone-600 font-medium leading-relaxed">{i.description}</div> : null}
              <div className="mt-6 grid gap-2">
                {i.location ? (
                  <div className="flex items-center gap-2 text-stone-500 font-bold">
                    <MapPin size={16} className="text-green-600" /> {i.location}
                  </div>
                ) : null}
                {i.contact ? (
                  <div className="flex items-center gap-2 text-stone-500 font-bold">
                    <Phone size={16} className="text-green-600" /> {i.contact}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

