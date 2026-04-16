'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Send, ShieldCheck, CheckCircle2, AlertCircle, Upload, X } from 'lucide-react';
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

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_EXT = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'zip',
  'rar',
  '7z',
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'mp4',
  'mov',
  'webm',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
];

function fileExt(name: string) {
  const n = String(name || '');
  const i = n.lastIndexOf('.');
  if (i <= 0 || i === n.length - 1) return '';
  return n.slice(i + 1).toLowerCase();
}

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
  const [attachments, setAttachments] = useState<
    { id: string; file: File; status: 'pending' | 'uploading' | 'uploaded' | 'error'; error?: string }[]
  >([]);

  const tokenFromQuery = searchParams.get('token');
  const effectiveToken = verificationToken || tokenFromQuery;

  const labels = useMemo(() => {
    const cs = {
      title: 'Schránka důvěry',
      subtitle: 'Podnět je interně ověřen školním e‑mailem. Pro administrátory je zobrazen anonymizovaně (redacted) a plný přístup má pouze správce systému.',
      start: 'Odeslat a ověřit',
      verify: 'Ověřit a odeslat',
      code: 'Kód z e‑mailu',
      upload: 'Přílohy (volitelné)',
      uploadHint: 'Lze přiložit více souborů. Podporované: PDF, DOCX, ZIP, MP3, MP4 aj. Odkaz na OneDrive vložte přímo do textu.',
      uploadStartFirst: 'Nejdřív klikněte na „Odeslat a ověřit“ a poté nahrajte přílohy.',
      uploadSelected: 'Nahrát vybrané',
      uploaded: 'Nahráno.',
      tooManyFiles: `Maximálně ${MAX_FILES} souborů.`,
      fileTooLarge: 'Soubor je větší než 10 MB.',
      unsupportedFile: 'Nepodporovaný typ souboru.',
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
      upload: 'Attachments (optional)',
      uploadHint: 'You can attach multiple files (PDF, DOCX, ZIP, MP3, MP4, etc.). Or paste a OneDrive link into the message.',
      uploadStartFirst: 'Click “Send and verify” first, then upload attachments.',
      uploadSelected: 'Upload selected',
      uploaded: 'Uploaded.',
      tooManyFiles: `Up to ${MAX_FILES} files.`,
      fileTooLarge: 'File is larger than 10 MB.',
      unsupportedFile: 'Unsupported file type.',
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
    if (!effectiveToken) throw new Error(labels.uploadStartFirst);
    const fd = new FormData();
    fd.set('token', effectiveToken);
    fd.set('file', file);
    const res = await fetch('/api/trustbox/attachments/upload', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Error');
  };

  const validateFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) return labels.fileTooLarge;
    const ext = fileExt(file.name);
    if (!ext || !ALLOWED_EXT.includes(ext)) return labels.unsupportedFile;
    if (ext === 'svg') return labels.unsupportedFile;
    return '';
  };

  const onSelectFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: { id: string; file: File; status: 'pending' | 'uploading' | 'uploaded' | 'error'; error?: string }[] = [];
    for (const f of Array.from(files)) {
      const err = validateFile(f);
      next.push({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        file: f,
        status: err ? 'error' : 'pending',
        error: err || undefined,
      });
    }

    setAttachments((prev) => {
      const merged = [...prev, ...next].slice(0, MAX_FILES);
      if (prev.length + next.length > MAX_FILES) showToast(labels.tooManyFiles, 'error');
      return merged;
    });
  };

  const uploadPending = async () => {
    if (!effectiveToken) {
      showToast(labels.uploadStartFirst, 'error');
      return;
    }
    setUploading(true);
    const current = attachments;
    for (const a of current) {
      if (a.status !== 'pending' && a.status !== 'error') continue;
      const err = validateFile(a.file);
      if (err) {
        setAttachments((prev) => prev.map((p) => (p.id === a.id ? { ...p, status: 'error', error: err } : p)));
        continue;
      }
      setAttachments((prev) => prev.map((p) => (p.id === a.id ? { ...p, status: 'uploading', error: undefined } : p)));
      try {
        await onUpload(a.file);
        setAttachments((prev) => prev.map((p) => (p.id === a.id ? { ...p, status: 'uploaded', error: undefined } : p)));
        showToast(labels.uploaded, 'success');
      } catch (e: any) {
        setAttachments((prev) => prev.map((p) => (p.id === a.id ? { ...p, status: 'error', error: e?.message || 'Error' } : p)));
        showToast(e?.message || 'Error', 'error');
      }
    }
    setUploading(false);
  };

  const accept = useMemo(() => ALLOWED_EXT.map((e) => `.${e}`).join(','), []);

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
                  <div className="text-xs text-stone-500 font-bold mb-3">{labels.uploadHint}</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition cursor-pointer">
                      <Upload size={16} />
                      {lang === 'en' ? 'Select files' : 'Vybrat soubory'}
                      <input
                        type="file"
                        multiple
                        accept={accept}
                        className="hidden"
                        onChange={(e) => {
                          onSelectFiles(e.target.files);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={uploadPending}
                      disabled={!attachments.some((a) => a.status === 'pending' || a.status === 'error') || !effectiveToken || uploading || loading}
                      className="inline-flex items-center gap-2 bg-white text-stone-700 px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      {uploading ? <InlinePulse className="bg-stone-500/70" size={14} /> : null}
                      {labels.uploadSelected}
                    </button>
                    <div className="text-stone-400 text-sm font-bold">max 10MB</div>
                  </div>

                  {attachments.length ? (
                    <div className="mt-4 space-y-2">
                      {attachments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3">
                          <div className="min-w-0">
                            <div className="font-bold text-stone-800 truncate">{a.file.name}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                              {a.status === 'pending'
                                ? (lang === 'en' ? 'Pending' : 'Připraveno')
                                : a.status === 'uploading'
                                  ? (lang === 'en' ? 'Uploading' : 'Nahrávám')
                                  : a.status === 'uploaded'
                                    ? (lang === 'en' ? 'Uploaded' : 'Nahráno')
                                    : (a.error || (lang === 'en' ? 'Error' : 'Chyba'))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((p) => p.id !== a.id))}
                            disabled={a.status === 'uploading'}
                            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                            aria-label={lang === 'en' ? 'Remove' : 'Odebrat'}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
                  <div className="text-xs text-stone-500 font-bold mb-3">{labels.uploadHint}</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition cursor-pointer">
                      <Upload size={16} />
                      {lang === 'en' ? 'Select files' : 'Vybrat soubory'}
                      <input
                        type="file"
                        multiple
                        accept={accept}
                        className="hidden"
                        onChange={(e) => {
                          onSelectFiles(e.target.files);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={uploadPending}
                      disabled={!attachments.some((a) => a.status === 'pending' || a.status === 'error') || !effectiveToken || uploading}
                      className="inline-flex items-center gap-2 bg-white text-stone-700 px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      {uploading ? <InlinePulse className="bg-stone-500/70" size={14} /> : null}
                      {labels.uploadSelected}
                    </button>
                    <div className="text-stone-400 text-sm font-bold">max 10MB</div>
                  </div>

                  {attachments.length ? (
                    <div className="mt-4 space-y-2">
                      {attachments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3">
                          <div className="min-w-0">
                            <div className="font-bold text-stone-800 truncate">{a.file.name}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                              {a.status === 'pending'
                                ? (lang === 'en' ? 'Pending' : 'Připraveno')
                                : a.status === 'uploading'
                                  ? (lang === 'en' ? 'Uploading' : 'Nahrávám')
                                  : a.status === 'uploaded'
                                    ? (lang === 'en' ? 'Uploaded' : 'Nahráno')
                                    : (a.error || (lang === 'en' ? 'Error' : 'Chyba'))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((p) => p.id !== a.id))}
                            disabled={a.status === 'uploading'}
                            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                            aria-label={lang === 'en' ? 'Remove' : 'Odebrat'}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
