'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';

export default function ReportModal({
  open,
  onClose,
  lang,
  targetType,
  targetId,
  targetLabel,
  sourceUrl,
}: {
  open: boolean;
  onClose: () => void;
  lang: string;
  targetType: 'user' | 'content';
  targetId: string;
  targetLabel?: string | null;
  sourceUrl?: string | null;
}) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('spam');
    setDetails('');
    setLoading(false);
  }, [open]);

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || '';
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const res = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          targetType,
          targetId,
          targetLabel,
          reason,
          details,
          sourceUrl,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      showToast(lang === 'en' ? 'Report submitted' : 'Nahlášení odesláno', 'success');
      onClose();
    } catch (e: any) {
      showToast(e?.message || (lang === 'en' ? 'Report failed' : 'Nahlášení se nezdařilo'), 'error');
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
      <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
              {lang === 'en' ? 'Report' : 'Nahlásit'}
            </div>
            <div className="font-black text-stone-900 truncate">{targetLabel || targetId}</div>
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

        <div className="p-8 space-y-5">
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
              {lang === 'en' ? 'Reason' : 'Důvod'}
            </div>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
            >
              <option value="spam">{lang === 'en' ? 'Spam' : 'Spam'}</option>
              <option value="abuse">{lang === 'en' ? 'Abuse' : 'Obtěžování'}</option>
              <option value="harassment">{lang === 'en' ? 'Harassment' : 'Nátlak / šikana'}</option>
              <option value="other">{lang === 'en' ? 'Other' : 'Jiné'}</option>
            </select>
          </div>

          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
              {lang === 'en' ? 'Details (optional)' : 'Popis (volitelné)'}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition resize-none"
              placeholder={lang === 'en' ? 'What happened?' : 'Co se stalo?'}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-red-200 bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? <InlinePulse className="bg-white/80" size={14} /> : <AlertTriangle size={16} />}
              {lang === 'en' ? 'Submit' : 'Odeslat'}
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
        </div>
      </div>
    </div>
  );
}
