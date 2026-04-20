'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, HandHeart, MapPin, Calendar, Map as MapIcon } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { getDictionary } from '@/lib/get-dictionary';
import Modal from '@/app/components/ui/Modal';
import Image from 'next/image';

const passthroughLoader = ({ src }: { src: string }) => src;

type Item = {
  id: string;
  title: string;
  description?: string | null;
  photo_url?: string | null;
  location?: string | null;
  created_at?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  status?: 'open' | 'returned' | string;
};

export default function LostFoundDetailPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const id = (params?.id as string) || '';

  const [dict, setDict] = useState<any>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimMessage, setClaimMessage] = useState('');
  const [claimAnonymous, setClaimAnonymous] = useState(false);
  const [claimSending, setClaimSending] = useState(false);
  const [claimSent, setClaimSent] = useState(false);

  useEffect(() => {
    getDictionary(lang).then((d) => setDict(d));
  }, [lang]);

  const common = dict?.common || {};
  const t = dict?.lostFoundDetailPage || {};

  const buildClaimEmailMessage = (it: Item) => {
    const template: string = t.emailBodyTemplate || '';
    if (!template) return claimMessage;
    return template
      .replaceAll('{id}', String(it.id))
      .replaceAll('{title}', String(it.title))
      .replaceAll('{message}', String(claimMessage || ''))
      .replaceAll('{email}', String(claimEmail || ''));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/lost-found/${encodeURIComponent(id)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Error');
        if (mounted) setItem(json?.item || null);
      } catch {
        if (mounted) setItem(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const submitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!claimAnonymous && !claimEmail) return;
    setClaimSending(true);
    try {
      const res = await fetch('/api/lost-found/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          name: claimName,
          email: claimEmail,
          message: buildClaimEmailMessage(item),
          isAnonymous: claimAnonymous,
        }),
      });
      if (!res.ok) throw new Error(t.sendError || 'Error');
      setClaimSent(true);
      setTimeout(() => {
        setClaimOpen(false);
        setClaimSent(false);
        setClaimEmail('');
        setClaimName('');
        setClaimMessage('');
        setClaimAnonymous(false);
      }, 2500);
    } catch {
      alert(t.sendError || '');
    } finally {
      setClaimSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between gap-4 mb-10">
          <Link
            href={`/${lang}/ztraty-a-nalezy`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            <ArrowLeft size={16} />
            {common.back || ''}
          </Link>
        </div>

        <div className="bg-white p-10 md:p-12 rounded-[3rem] border border-stone-100 shadow-sm">
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <InlinePulse className="bg-stone-200" size={18} />
            </div>
          ) : !item ? (
            <div className="bg-stone-50 border border-dashed border-stone-200 rounded-[2rem] p-12 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              {t.notFound || ''}
            </div>
          ) : (
            <div className="space-y-8">
              {item.photo_url ? (
                <div className="aspect-[16/9] rounded-[2rem] overflow-hidden bg-stone-100 relative">
                  <Image
                    loader={passthroughLoader}
                    unoptimized
                    src={item.photo_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 768px"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}

              <div>
                <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight">{item.title}</h1>
                {item.description ? (
                  <p className="text-stone-600 font-medium mt-4 whitespace-pre-line">{item.description}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-stone-600">
                {item.location ? (
                  <div className="inline-flex items-center gap-2">
                    <MapPin size={16} className="text-green-600" />
                    {item.location}
                  </div>
                ) : null}
                {item.created_at ? (
                  <div className="inline-flex items-center gap-2">
                    <Calendar size={16} className="text-green-600" />
                    {new Date(item.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                  </div>
                ) : null}
                {Number.isFinite(Number(item.location_lat)) && Number.isFinite(Number(item.location_lng)) ? (
                  <a
                    href={`https://maps.google.com/?q=${item.location_lat},${item.location_lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 underline decoration-dotted"
                  >
                    <MapIcon size={16} className="text-green-600" />
                    {lang === 'en' ? 'Map pin' : 'Pin na mapě'}
                  </a>
                ) : null}
              </div>

              {item.status === 'open' ? (
                <button
                  type="button"
                  onClick={() => setClaimOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-stone-800 transition"
                >
                  <HandHeart size={18} />
                  {t.cta || ''}
                </button>
              ) : (
                <div className="bg-stone-50 border border-stone-100 rounded-2xl p-6 text-stone-500 font-bold">
                  {t.returned || ''}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={!!(claimOpen && item)} onClose={() => setClaimOpen(false)} maxWidthClassName="max-w-md">
        {item ? (
          <div>
            <h3 className="text-2xl font-black text-stone-900 mb-2">{t.modalTitle || ''}</h3>
            <p className="text-stone-500 mb-6 font-medium">
              {(t.modalSubtitlePrefix || '')}{' '}
              <strong className="text-stone-900">{item.title}</strong>
            </p>

            {claimSent ? (
              <div className="bg-green-50 text-green-700 p-6 rounded-2xl text-center font-bold">
                {t.sent || ''}
              </div>
            ) : (
              <form onSubmit={submitClaim} className="space-y-4">
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
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">{t.email || common.email || 'E-mail'}</label>
                  <input
                    type="email"
                    required={!claimAnonymous}
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    placeholder={t.emailPlaceholder || ''}
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
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                    {t.messageLabel || ''}
                  </label>
                  <textarea
                    required
                    value={claimMessage}
                    onChange={(e) => setClaimMessage(e.target.value)}
                    rows={4}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-medium text-stone-700 focus:ring-2 focus:ring-green-500 transition resize-none"
                    placeholder={t.messagePlaceholder || ''}
                  />
                </div>
                <button
                  type="submit"
                  disabled={claimSending}
                  className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {claimSending ? <InlinePulse className="bg-white" size={16} /> : <HandHeart size={18} />}
                  {t.sendRequest || ''}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
