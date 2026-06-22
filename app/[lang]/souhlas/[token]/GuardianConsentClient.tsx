'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, FileUp, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function GuardianConsentClient({ lang, token }: { lang: 'cs' | 'en'; token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useMemo(
    () =>
      lang === 'en'
        ? {
            title: 'Guardian consent',
            intro: 'Download the pre-filled PDF, have it signed by a legal guardian and upload the signed version back here.',
            download: 'Download PDF',
            upload: 'Upload signed consent',
            uploaded: 'Signed consent has been uploaded successfully.',
            choose: 'Choose signed PDF',
            back: 'Back to events',
          }
        : {
            title: 'Souhlas zákonného zástupce',
            intro: 'Stáhněte si předvyplněné PDF, nechte ho podepsat zákonným zástupcem a podepsanou verzi sem nahrajte zpět.',
            download: 'Stáhnout PDF',
            upload: 'Nahrát podepsaný souhlas',
            uploaded: 'Podepsaný souhlas byl úspěšně nahrán.',
            choose: 'Vyberte podepsané PDF',
            back: 'Zpět na akce',
          },
    [lang],
  );

  const onUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('token', token);
      form.set('file', file);
      const resp = await fetch('/api/rsvp/guardian-consent', { method: 'POST', body: form });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(String(json?.error || 'Error'));
      setUploaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-stone-400">
            {lang === 'en' ? 'Documents' : 'Dokumenty'}
          </div>
          <h1 className="mt-3 text-3xl font-black text-stone-900">{copy.title}</h1>
          <p className="mt-3 text-sm font-bold text-stone-600">{copy.intro}</p>
        </div>

        <section className="rounded-[2rem] border border-stone-100 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0" />
            <div className="text-sm font-bold">
              {lang === 'en'
                ? 'This document is required because at least one registered participant is under 18 years old.'
                : 'Tento dokument je povinný, protože alespoň jeden registrovaný účastník je mladší 18 let.'}
            </div>
          </div>

          <a
            href={`/api/rsvp/guardian-consent?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white"
          >
            <Download size={16} />
            {copy.download}
          </a>

          <div className="rounded-[1.5rem] border border-stone-100 bg-stone-50 p-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">{copy.choose}</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-3 block w-full text-sm font-bold text-stone-700"
            />
            <button
              type="button"
              disabled={!file || busy}
              onClick={onUpload}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm font-black uppercase tracking-widest text-stone-700 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
              {copy.upload}
            </button>
          </div>

          {uploaded ? (
            <div className="flex items-start gap-3 rounded-[1.5rem] border border-green-200 bg-green-50 p-4 text-green-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-sm font-bold">{copy.uploaded}</div>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-3 rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-red-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-sm font-bold">{error}</div>
            </div>
          ) : null}
        </section>

        <div className="text-center">
          <Link href={`/${lang}/akce`} className="text-sm font-black text-green-700 underline underline-offset-4">
            {copy.back}
          </Link>
        </div>
      </div>
    </main>
  );
}
