'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCcw, X } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import Portal from '@/app/components/ui/Portal';

export default function RefundRequestModal({
  open,
  onClose,
  lang,
  rsvp,
}: {
  open: boolean;
  onClose: () => void;
  lang: string;
  rsvp: any | null;
}) {
  const { showToast } = useToast();
  const [policy, setPolicy] = useState('');
  const [policyLoading, setPolicyLoading] = useState(false);
  const [reason, setReason] = useState('changed_mind');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('changed_mind');
    setNote('');
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setPolicyLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');
        const res = await fetch('/api/governance/refund-policy', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Request failed');
        setPolicy(String(json?.text || ''));
      } catch {
        setPolicy('');
      } finally {
        setPolicyLoading(false);
      }
    })();
  }, [lang, open]);

  const submit = async () => {
    if (!rsvp) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const res = await fetch('/api/refunds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rsvpId: rsvp.id,
          eventId: rsvp.event_id,
          eventTitle: lang === 'en' && rsvp.event?.title_en ? rsvp.event.title_en : rsvp.event?.title || '---',
          reason,
          note: note.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      showToast(lang === 'en' ? 'Refund request sent' : 'Žádost o refund odeslána', 'success');
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !rsvp) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[10003] flex items-center justify-center p-6">
        <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Zavřít" />
        <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
              {lang === 'en' ? 'Refund request' : 'Žádost o refund'}
            </div>
            <div className="font-black text-stone-900 truncate">{lang === 'en' && rsvp.event?.title_en ? rsvp.event.title_en : rsvp.event?.title}</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400" aria-label="Zavřít">
            <X size={18} />
          </button>
        </div>

        <div className="p-8 space-y-5">
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                {lang === 'en' ? 'Policy' : 'Refund politika'}
              </div>
              {policyLoading && <InlinePulse className="bg-stone-300" size={12} />}
            </div>
            <div className="text-sm font-medium text-stone-700 whitespace-pre-line">
              {policy || (lang === 'en' ? 'No policy text set.' : 'Politika zatím není nastavena.')}
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
              {lang === 'en' ? 'Reason' : 'Důvod'}
            </div>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
            >
              <option value="changed_mind">{lang === 'en' ? 'Changed my mind' : 'Změna plánů'}</option>
              <option value="illness">{lang === 'en' ? 'Illness' : 'Nemoc'}</option>
              <option value="duplicate">{lang === 'en' ? 'Duplicate order' : 'Duplicitní registrace'}</option>
              <option value="other">{lang === 'en' ? 'Other' : 'Jiné'}</option>
            </select>
          </div>

          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
              {lang === 'en' ? 'Note (optional)' : 'Poznámka (volitelné)'}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition resize-none"
              placeholder={lang === 'en' ? 'Anything we should know?' : 'Doplňte informace…'}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-amber-200 bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50"
            >
              {loading ? <InlinePulse className="bg-white/80" size={14} /> : <RefreshCcw size={16} />}
              {lang === 'en' ? 'Send request' : 'Odeslat žádost'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
            >
              <AlertCircle size={16} />
              {lang === 'en' ? 'Cancel' : 'Zrušit'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </Portal>
  );
}
