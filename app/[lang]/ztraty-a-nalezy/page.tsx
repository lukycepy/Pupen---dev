'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, MapPin, Phone, ShieldCheck, Search, HandHeart, Map as MapIcon } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import Dialog from '@/app/components/ui/Dialog';

type Item = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  contact: string | null;
  status: string;
  location_lat?: number | null;
  location_lng?: number | null;
};

export default function LostFoundPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const statusLabel = (v: any) => {
    const s = String(v || '').trim();
    if (s === 'open') return lang === 'en' ? 'Open' : 'Aktivní';
    if (s === 'claimed') return lang === 'en' ? 'Claimed' : 'Nárokováno';
    if (s === 'in_progress') return lang === 'en' ? 'In progress' : 'V řešení';
    if (s === 'returned') return lang === 'en' ? 'Returned' : 'Vráceno';
    if (s === 'archived') return lang === 'en' ? 'Archived' : 'Archivováno';
    return s || '—';
  };
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'claimed' | 'in_progress' | 'returned'>('open');
  const [claimingItem, setClaimingItem] = useState<Item | null>(null);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimMessage, setClaimMessage] = useState('');
  const [claimAnonymous, setClaimAnonymous] = useState(false);
  const [claimSending, setClaimSending] = useState(false);
  const [claimSent, setClaimSent] = useState(false);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingItem) return;
    if (!claimAnonymous && !claimEmail) return;
    setClaimSending(true);
    try {
      const res = await fetch('/api/lost-found/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: claimingItem.id,
          name: claimName,
          email: claimEmail,
          message: claimMessage,
          isAnonymous: claimAnonymous,
        })
      });
      if (!res.ok) throw new Error('Chyba odeslání');
      setClaimSent(true);
      setTimeout(() => {
        setClaimingItem(null);
        setClaimSent(false);
        setClaimEmail('');
        setClaimName('');
        setClaimMessage('');
        setClaimAnonymous(false);
      }, 3000);
    } catch {
      alert(lang === 'en' ? 'Error sending request' : 'Chyba při odesílání žádosti');
    } finally {
      setClaimSending(false);
    }
  };

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
              <option value="claimed">{lang === 'en' ? 'Claimed' : 'Nárokováno'}</option>
              <option value="in_progress">{lang === 'en' ? 'In progress' : 'V řešení'}</option>
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
              <Link href={`/${lang}/ztraty-a-nalezy/${i.id}`} className="block">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 text-lg truncate hover:text-green-700 transition">{i.title}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                      {new Date(i.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                      {i.category ? ` • ${i.category}` : ''}
                      {i.status ? ` • ${statusLabel(i.status)}` : ''}
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
                  {Number.isFinite(Number(i.location_lat)) && Number.isFinite(Number(i.location_lng)) ? (
                    <div className="flex items-center gap-2 text-stone-500 font-bold">
                      <MapIcon size={16} className="text-green-600" />
                      <a
                        href={`https://maps.google.com/?q=${i.location_lat},${i.location_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-dotted"
                      >
                        {lang === 'en' ? 'Map pin' : 'Pin na mapě'}
                      </a>
                    </div>
                  ) : null}
                </div>
              </Link>
              {i.status === 'open' && (
                <div className="mt-6 pt-6 border-t border-stone-100">
                  <button 
                    onClick={() => setClaimingItem(i)}
                    className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition"
                  >
                    <HandHeart size={18} />
                    {lang === 'en' ? 'This is mine!' : 'To je moje!'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Claim Modal */}
      {claimingItem && (
        <Dialog
          open={!!claimingItem}
          onClose={() => setClaimingItem(null)}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          panelClassName="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative"
        >
              <button onClick={() => setClaimingItem(null)} className="absolute top-6 right-6 text-stone-400 hover:text-stone-900">✕</button>
              <h3 className="text-2xl font-black text-stone-900 mb-2">{lang === 'en' ? 'Claim item' : 'Žádost o navrácení'}</h3>
              <p className="text-stone-500 mb-6 font-medium">
                {lang === 'en' ? `You are claiming: ` : `Žádáte o navrácení věci: `} 
                <strong className="text-stone-900">{claimingItem.title}</strong>
              </p>

            {claimSent ? (
              <div className="bg-green-50 text-green-700 p-6 rounded-2xl text-center font-bold">
                {lang === 'en' ? 'Request sent! We will contact you soon.' : 'Žádost odeslána! Brzy se vám ozveme.'}
              </div>
            ) : (
              <form onSubmit={handleClaimSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                    {lang === 'en' ? 'Name (optional)' : 'Jméno (volitelné)'}
                  </label>
                  <input
                    value={claimName}
                    onChange={(e) => setClaimName(e.target.value)}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    placeholder={lang === 'en' ? 'Your name' : 'Vaše jméno'}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">E-mail</label>
                  <input
                    type="email"
                    required={!claimAnonymous}
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    placeholder="vas@email.cz"
                    disabled={claimAnonymous}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-stone-700">
                  <input
                    type="checkbox"
                    checked={claimAnonymous}
                    onChange={(e) => setClaimAnonymous(e.target.checked)}
                    className="w-4 h-4"
                  />
                  {lang === 'en' ? 'Submit anonymously' : 'Odeslat anonymně'}
                </label>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">{lang === 'en' ? 'Message (how do you prove it is yours?)' : 'Zpráva (jak prokážete, že je věc vaše?)'}</label>
                  <textarea
                    required
                    value={claimMessage}
                    onChange={(e) => setClaimMessage(e.target.value)}
                    rows={4}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-medium text-stone-700 focus:ring-2 focus:ring-green-500 transition resize-none"
                    placeholder={lang === 'en' ? 'Describe specific details...' : 'Popište specifické detaily věci...'}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={claimSending}
                  className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {claimSending ? <InlinePulse className="bg-white" size={16} /> : <HandHeart size={18} />}
                  {lang === 'en' ? 'Send request' : 'Odeslat žádost'}
                </button>
              </form>
            )}
        </Dialog>
      )}
    </div>
  );
}
