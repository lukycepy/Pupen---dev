'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, X } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';

type BuyerType = 'person' | 'company';

export default function InvoiceRequestModal({
  open,
  onClose,
  lang,
  rsvpId,
  eventId,
  eventTitle,
  email,
  defaultName,
}: {
  open: boolean;
  onClose: () => void;
  lang: string;
  rsvpId: string;
  eventId: string;
  eventTitle: string;
  email: string;
  defaultName: string;
}) {
  const { showToast } = useToast();
  const [buyerType, setBuyerType] = useState<BuyerType>('person');
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [ico, setIco] = useState('');
  const [dic, setDic] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => (lang === 'en' ? 'Invoice request' : 'Žádost o fakturu'), [lang]);

  useEffect(() => {
    if (!open) return;
    setBuyerType('person');
    setBuyerName(defaultName || '');
    setBuyerAddress('');
    setIco('');
    setDic('');
    setNote('');
    setLoading(false);
  }, [defaultName, open]);

  const submit = async () => {
    if (!buyerName.trim() || !buyerAddress.trim()) {
      showToast(lang === 'en' ? 'Fill name and address' : 'Vyplňte jméno/název a adresu', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/invoices/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rsvpId,
          eventId,
          eventTitle,
          email,
          buyerType,
          buyerName: buyerName.trim(),
          buyerAddress: buyerAddress.trim(),
          ico: ico.trim(),
          dic: dic.trim(),
          note: note.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Request failed');
      }
      showToast(lang === 'en' ? 'Invoice requested' : 'Žádost o fakturu odeslána', 'success');
      onClose();
    } catch (e: any) {
      showToast(e?.message || (lang === 'en' ? 'Request failed' : 'Odeslání se nezdařilo'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10003] flex items-center justify-center p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Zavřít"
      />

      <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
              {title}
            </div>
            <div className="font-black text-stone-900 truncate">{eventTitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400"
            aria-label="Zavřít"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
              {lang === 'en' ? 'Buyer type' : 'Typ odběratele'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBuyerType('person')}
                className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition ${
                  buyerType === 'person'
                    ? 'bg-green-50 border-green-600 text-green-700'
                    : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                }`}
              >
                {lang === 'en' ? 'Person' : 'Osoba'}
              </button>
              <button
                type="button"
                onClick={() => setBuyerType('company')}
                className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition ${
                  buyerType === 'company'
                    ? 'bg-green-50 border-green-600 text-green-700'
                    : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                }`}
              >
                {lang === 'en' ? 'Company' : 'Firma'}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                {lang === 'en' ? 'Name / Company' : 'Jméno / Název firmy'}
              </label>
              <input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                {lang === 'en' ? 'Address' : 'Adresa'}
              </label>
              <textarea
                value={buyerAddress}
                onChange={(e) => setBuyerAddress(e.target.value)}
                rows={3}
                className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
                placeholder={lang === 'en' ? 'Street, City, ZIP, Country' : 'Ulice, město, PSČ, stát'}
              />
            </div>
            {buyerType === 'company' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">IČO</label>
                  <input
                    value={ico}
                    onChange={(e) => setIco(e.target.value)}
                    className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">DIČ</label>
                  <input
                    value={dic}
                    onChange={(e) => setDic(e.target.value)}
                    className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                  />
                </div>
              </>
            )}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                {lang === 'en' ? 'Note (optional)' : 'Poznámka (volitelné)'}
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                placeholder={lang === 'en' ? 'e.g. proforma, PO number…' : 'např. číslo objednávky…'}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              {loading ? <InlinePulse className="bg-white/80" size={14} /> : <FileText size={16} />}
              {lang === 'en' ? 'Request invoice' : 'Vyžádat fakturu'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
            >
              {lang === 'en' ? 'Cancel' : 'Zrušit'}
            </button>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
            RSVP: {rsvpId} • {email}
          </div>
        </div>
      </div>
    </div>
  );
}

