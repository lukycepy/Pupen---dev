'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Send, ShieldCheck, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';

type Topic = { id: string; cs: string; en: string };

const TOPICS: Topic[] = [
  { id: 'accommodation', cs: 'Ubytování / KaM', en: 'Accommodation' },
  { id: 'canteen', cs: 'Menza / stravování', en: 'Canteen' },
  { id: 'study', cs: 'Studium / výuka', en: 'Study / teaching' },
  { id: 'safety', cs: 'Bezpečnost', en: 'Safety' },
  { id: 'harassment', cs: 'Nevhodné chování / šikana', en: 'Harassment' },
  { id: 'finance', cs: 'Finance', en: 'Finance' },
  { id: 'accessibility', cs: 'Přístupnost', en: 'Accessibility' },
  { id: 'organization', cs: 'Organizace / procesy', en: 'Organization / process' },
  { id: 'other', cs: 'Jiné', en: 'Other' },
];

export default function TrustBoxPageClient() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [allowFollowup, setAllowFollowup] = useState(true);
  const [allowForwardToFaculty, setAllowForwardToFaculty] = useState(false);
  const [honeyPot, setHoneyPot] = useState('');

  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'started' | 'verified'>('idle');

  const tokenFromQuery = searchParams.get('token');
  const effectiveToken = verificationToken || tokenFromQuery;

  const labels = useMemo(() => {
    const cs = {
      title: 'Schránka důvěry',
      subtitle: 'Podnět je interně ověřen školním e‑mailem. Pro administrátory je zobrazen anonymizovaně (redacted) a plný přístup má pouze správce systému.',
      start: 'Odeslat a ověřit',
      verify: 'Ověřit a odeslat',
      code: 'Kód z e‑mailu',
      upload: 'Nahrát přílohu (volitelné)',
      followup: 'Chci možnost další komunikace (ticket)',
      forward: 'Souhlasím s předáním fakultě (pokud bude potřeba)',
      urgent: 'Urgentní',
      okStarted: 'Ověření odesláno. Zkontrolujte e‑mail.',
      okVerified: 'Podnět byl přijat. Děkujeme za důvěru.',
    };
    const en = {
      title: 'Trust Box',
      subtitle: 'The report is internally verified via CZU email. Admin view is redacted by default; only the system owner can see full identity.',
      start: 'Send and verify',
      verify: 'Verify and submit',
      code: 'Email code',
      upload: 'Upload attachment (optional)',
      followup: 'Enable follow-up (ticket thread)',
      forward: 'I allow forwarding to faculty if needed',
      urgent: 'Urgent',
      okStarted: 'Verification email sent. Please check your inbox.',
      okVerified: 'Report received. Thank you.',
    };
    return lang === 'en' ? en : cs;
  }, [lang]);

  const onStart = async () => {
    if (honeyPot) return;
    setLoading(true);
    try {
      const res = await fetch('/api/trustbox/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          firstName,
          lastName,
          email,
          category: topic,
          subject,
          message,
          priority,
          allowFollowup,
          allowForwardToFaculty,
          website: honeyPot,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      const token = String(json?.verificationToken || '').trim();
      setVerificationToken(token);
      setStatus('started');
      showToast(labels.okStarted, 'success');
      return token;
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const onUpload = async (file: File) => {
    const token = effectiveToken || (await onStart());
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
    if (!effectiveToken) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/trustbox/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, token: effectiveToken, code, website: honeyPot }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      setStatus('verified');
      showToast(labels.okVerified, 'success');
      const followupToken = json?.followupToken ? String(json.followupToken) : '';
      if (followupToken) {
        router.push(`/${lang}/schranka-duvery/ticket?token=${encodeURIComponent(followupToken)}`);
      }
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{labels.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{labels.subtitle}</p>
        </div>

        {status === 'verified' ? (
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-green-100 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
              <CheckCircle2 size={36} />
            </div>
            <div className="text-xl font-black text-stone-900 mb-2">{labels.okVerified}</div>
          </div>
        ) : (
          <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-stone-100">
            <input type="text" name="website" value={honeyPot} onChange={(e) => setHoneyPot(e.target.value)} className="opacity-0 absolute -z-10 w-0 h-0" tabIndex={-1} autoComplete="off" />

            {status === 'idle' && (
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Jméno</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Příjmení</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Fakultní e‑mail</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Typ podnětu</label>
                  <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition">
                    {TOPICS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {lang === 'en' ? t.en : t.cs}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Předmět</label>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Popis</label>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition resize-none" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{labels.upload}</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition cursor-pointer">
                      {uploading || loading ? <InlinePulse className="bg-white/80" size={14} /> : <Upload size={16} />}
                      {uploading || loading ? (lang === 'en' ? 'Uploading' : 'Nahrávám') : (lang === 'en' ? 'Select file' : 'Vybrat soubor')}
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
                    <div className="text-stone-400 text-sm font-bold">max 10MB</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 font-bold text-stone-700">
                    <input type="checkbox" checked={priority === 'urgent'} onChange={(e) => setPriority(e.target.checked ? 'urgent' : 'normal')} />
                    {labels.urgent}
                  </label>
                  <label className="flex items-center gap-3 font-bold text-stone-700">
                    <input type="checkbox" checked={allowFollowup} onChange={(e) => setAllowFollowup(e.target.checked)} />
                    {labels.followup}
                  </label>
                  <label className="flex items-center gap-3 font-bold text-stone-700">
                    <input type="checkbox" checked={allowForwardToFaculty} onChange={(e) => setAllowForwardToFaculty(e.target.checked)} />
                    {labels.forward}
                  </label>
                </div>

                <button
                  disabled={loading}
                  onClick={onStart}
                  className="w-full bg-green-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-xl shadow-green-900/20 flex items-center justify-center gap-3"
                >
                  {loading ? <InlinePulse className="bg-white/80" size={14} /> : <Send size={20} />}
                  {labels.start}
                </button>
              </div>
            )}

            {status === 'started' && (
              <div className="space-y-5">
                <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 p-5 rounded-2xl">
                  <AlertCircle className="text-stone-400 mt-0.5" size={18} />
                  <div className="text-stone-700 font-bold">{labels.okStarted}</div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{labels.code}</label>
                  <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder="123456" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{labels.upload}</label>
                  <div className="flex items-center gap-3">
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
                    <div className="text-stone-400 text-sm font-bold">max 10MB</div>
                  </div>
                </div>

                <button
                  disabled={verifying || !code || !effectiveToken}
                  onClick={onVerify}
                  className="w-full bg-green-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-xl shadow-green-900/20 flex items-center justify-center gap-3"
                >
                  {verifying ? <InlinePulse className="bg-white/80" size={14} /> : <CheckCircle2 size={20} />}
                  {labels.verify}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
