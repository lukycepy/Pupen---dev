'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Upload, ShieldCheck } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';

export default function TrustBoxVerifyClient() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const sp = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const token = String(sp.get('token') || '').trim();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [uploading, setUploading] = useState(false);

  const labels = useMemo(() => {
    return lang === 'en'
      ? { title: 'Trust Box verification', code: 'Email code', verify: 'Verify and submit', upload: 'Upload attachment (optional)' }
      : { title: 'Ověření schránky důvěry', code: 'Kód z e‑mailu', verify: 'Ověřit a odeslat', upload: 'Nahrát přílohu (volitelné)' };
  }, [lang]);

  const onUpload = async (file: File) => {
    if (!token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('file', file);
      const res = await fetch('/api/trustbox/attachments/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      showToast(lang === 'en' ? 'Uploaded.' : 'Nahráno.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onVerify = async () => {
    if (!token) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/trustbox/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, token, code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      const followupToken = json?.followupToken ? String(json.followupToken) : '';
      if (followupToken) {
        router.push(`/${lang}/schranka-duvery/ticket?token=${encodeURIComponent(followupToken)}`);
      } else {
        router.push(`/${lang}/schranka-duvery`);
      }
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tighter mb-2">{labels.title}</h1>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-stone-100 space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{labels.code}</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder="123456" />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{labels.upload}</label>
            <label className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition cursor-pointer">
              {uploading ? <InlinePulse className="bg-white/80" size={14} /> : <Upload size={16} />}
              {uploading ? (lang === 'en' ? 'Uploading' : 'Nahrávám') : (lang === 'en' ? 'Select file' : 'Vybrat soubor')}
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          <button
            disabled={!token || !code || verifying}
            onClick={onVerify}
            className="w-full bg-green-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-xl shadow-green-900/20 flex items-center justify-center gap-3"
          >
            {verifying ? <InlinePulse className="bg-white/80" size={14} /> : <CheckCircle2 size={20} />}
            {labels.verify}
          </button>
        </div>
      </div>
    </div>
  );
}

