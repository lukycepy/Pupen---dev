'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, XCircle, Camera, Loader2, ArrowLeft, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { normalizeTicketToken } from '@/lib/tickets/token';

type TicketValidationResponse = {
  ok?: boolean;
  status?: string;
  validationStatus?: string;
  ticket?: {
    rsvpId: string;
    eventId: string;
    eventTitle: string;
    eventDate: string | null;
    eventLocation: string | null;
    name: string;
    email: string;
    status: string;
    checkedIn: boolean;
    checkedInAt: string | null;
    firstCheckedInAt: string | null;
    firstCheckedInBy: string | null;
    paymentMethod: string | null;
    priceTotal: number | null;
    pricingLabel: string | null;
    variableSymbol: string | null;
    attendeesCount: number;
    token: string;
  };
  error?: string;
};

function statusMeta(status: string, lang: string) {
  if (status === 'valid') {
    return {
      className: 'border-green-200 bg-green-50 text-green-900',
      icon: CheckCircle2,
      title: lang === 'en' ? 'Valid ticket' : 'Platná vstupenka',
      text: lang === 'en' ? 'The ticket can be admitted.' : 'Vstupenka je připravena k odbavení.',
    };
  }
  if (status === 'already_checked_in') {
    return {
      className: 'border-red-200 bg-red-50 text-red-900',
      icon: AlertTriangle,
      title: lang === 'en' ? 'Already used' : 'Již použitá vstupenka',
      text: lang === 'en' ? 'The ticket was already checked in.' : 'Tato vstupenka už byla odbavena.',
    };
  }
  if (status === 'awaiting_payment') {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      icon: AlertTriangle,
      title: lang === 'en' ? 'Awaiting payment' : 'Čeká na platbu',
      text: lang === 'en' ? 'Registration exists but payment is not completed yet.' : 'Registrace existuje, ale platba zatím není dokončena.',
    };
  }
  if (status === 'waitlist') {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      icon: AlertTriangle,
      title: lang === 'en' ? 'Waitlist only' : 'Pouze čekací listina',
      text: lang === 'en' ? 'This person is still on the waitlist.' : 'Tato osoba je stále na čekací listině.',
    };
  }
  return {
    className: 'border-red-200 bg-red-50 text-red-900',
    icon: XCircle,
    title: lang === 'en' ? 'Invalid code' : 'Neplatný kód',
    text: lang === 'en' ? 'Ticket does not exist, is cancelled or expired.' : 'Vstupenka neexistuje, je stornovaná nebo expirovaná.',
  };
}

export default function ValidateTicketClient({ lang }: { lang: string }) {
  const searchParams = useSearchParams();
  const initialToken = normalizeTicketToken(searchParams.get('token') || '');
  const [token, setToken] = useState(initialToken);
  const [scanBusy, setScanBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [result, setResult] = useState<TicketValidationResponse | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanBusyRef = useRef(false);

  const validateTicket = useCallback(
    async (rawToken: string) => {
      const normalized = normalizeTicketToken(rawToken);
      if (!normalized) return;
      setLoading(true);
      setToken(normalized);
      try {
        const { data } = await supabase.auth.getSession();
        const auth = data.session?.access_token;
        if (!auth) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášený administrátor');

        const resp = await fetch(`/api/admin/tickets/validate?token=${encodeURIComponent(normalized)}&lang=${encodeURIComponent(lang)}`, {
          headers: { Authorization: `Bearer ${auth}` },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setResult({ ok: false, status: 'invalid', validationStatus: 'invalid', error: String(json?.error || 'Invalid') });
          return;
        }
        setResult(json);
      } catch (error) {
        setResult({ ok: false, status: 'invalid', validationStatus: 'invalid', error: error instanceof Error ? error.message : 'Error' });
      } finally {
        setLoading(false);
      }
    },
    [lang],
  );

  const performCheckIn = useCallback(async () => {
    if (!result?.ticket?.eventId || !result?.ticket?.rsvpId) return;
    setCheckInLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const auth = data.session?.access_token;
      if (!auth) throw new Error('Unauthorized');
      const resp = await fetch('/api/admin/tickets/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
        body: JSON.stringify({
          eventId: result.ticket.eventId,
          rsvpId: result.ticket.rsvpId,
          checkedIn: true,
          source: 'validate_page',
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(String(json?.error || 'Error'));
      setResult({
        ok: true,
        status: 'checked_in',
        validationStatus: 'already_checked_in',
        ticket: json?.ticket || result.ticket,
      });
    } catch (error) {
      setResult((prev) => ({
        ...(prev || {}),
        error: error instanceof Error ? error.message : 'Error',
      }));
    } finally {
      setCheckInLoading(false);
    }
  }, [result]);

  useEffect(() => {
    if (initialToken) validateTicket(initialToken);
  }, [initialToken, validateTicket]);

  useEffect(() => {
    scanBusyRef.current = scanBusy;
  }, [scanBusy]);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
  }, []);

  const processToken = useCallback(
    async (rawValue: string) => {
      if (scanBusyRef.current) return;
      setScanBusy(true);
      await validateTicket(rawValue);
      setScanBusy(false);
    },
    [validateTicket],
  );

  useEffect(() => {
    if (!scannerOpen) return;

    let cleanupRaf: null | (() => void) = null;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        const Detector = (window as Window & { BarcodeDetector?: new (...args: any[]) => { detect: (input: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
        if (!Detector) return;
        const detector = new Detector({ formats: ['qr_code'] });

        let raf = 0;
        const tick = async () => {
          const videoElement = videoRef.current;
          if (!videoElement || videoElement.readyState < 2 || scanBusyRef.current) {
            raf = window.requestAnimationFrame(tick);
            return;
          }
          try {
            const codes = await detector.detect(videoElement);
            const first = codes?.[0]?.rawValue;
            if (first) {
              await processToken(first);
            }
          } catch {}
          raf = window.requestAnimationFrame(tick);
        };
        raf = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(raf);
      } catch {
        return null;
      }
    };

    start().then((cleanup) => {
      cleanupRaf = typeof cleanup === 'function' ? cleanup : null;
    });

    return () => {
      cleanupRaf?.();
      stopStream();
    };
  }, [processToken, scannerOpen, stopStream]);

  const meta = useMemo(() => statusMeta(result?.validationStatus || result?.status || 'invalid', lang), [lang, result?.status, result?.validationStatus]);
  const MetaIcon = meta.icon;
  const canCheckIn = result?.validationStatus === 'valid' && result.ticket?.checkedIn !== true;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {lang === 'en' ? 'Organizer' : 'Pořadatel'}
            </div>
            <h1 className="text-2xl font-black text-stone-900">
              {lang === 'en' ? 'Ticket validation' : 'Validace vstupenky'}
            </h1>
          </div>
          <Link
            href={`/${lang}/admin/dashboard`}
            className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-stone-700"
          >
            <ArrowLeft size={14} />
            {lang === 'en' ? 'Dashboard' : 'Dashboard'}
          </Link>
        </div>

        <div className="rounded-[2rem] border border-stone-100 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {lang === 'en' ? 'Token or QR URL' : 'Token nebo QR URL'}
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={lang === 'en' ? 'Paste token or scan QR' : 'Vložte token nebo naskenujte QR'}
              className="w-full rounded-2xl border-none bg-stone-50 px-5 py-4 font-bold text-stone-800 outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => validateTicket(token)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                {lang === 'en' ? 'Validate' : 'Ověřit'}
              </button>
              <button
                type="button"
                onClick={() => setScannerOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-stone-700"
              >
                <Camera size={14} />
                {scannerOpen ? (lang === 'en' ? 'Hide scanner' : 'Skrýt skener') : lang === 'en' ? 'Scan QR' : 'Skenovat QR'}
              </button>
            </div>
          </div>

          {scannerOpen ? (
            <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-stone-100 bg-stone-950">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline autoPlay />
            </div>
          ) : null}
        </div>

        {result ? (
          <section className={`rounded-[2rem] border p-5 shadow-sm ${meta.className}`}>
            <div className="flex items-start gap-4">
              <MetaIcon size={28} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
                    {lang === 'en' ? 'Validation result' : 'Výsledek validace'}
                  </div>
                  <h2 className="text-2xl font-black">{meta.title}</h2>
                  <p className="mt-1 text-sm font-bold opacity-80">{meta.text}</p>
                </div>

                {result.ticket ? (
                  <div className="grid gap-3 rounded-[1.5rem] border border-current/10 bg-white/70 p-4 text-stone-900">
                    <div className="text-lg font-black">{result.ticket.name || result.ticket.email}</div>
                    <div className="text-sm font-bold">{result.ticket.eventTitle}</div>
                    <div className="text-xs font-bold text-stone-600">
                      {result.ticket.eventDate ? new Date(result.ticket.eventDate).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ') : ''}
                      {result.ticket.eventLocation ? ` • ${result.ticket.eventLocation}` : ''}
                    </div>
                    <div className="text-xs font-bold text-stone-600">
                      {result.ticket.pricingLabel ? `${result.ticket.pricingLabel} • ` : ''}
                      {result.ticket.priceTotal != null ? `${Number(result.ticket.priceTotal).toFixed(2)} CZK` : ''}
                      {result.ticket.variableSymbol ? ` • VS ${result.ticket.variableSymbol}` : ''}
                    </div>
                    {result.validationStatus === 'already_checked_in' && result.ticket.firstCheckedInAt ? (
                      <div className="text-xs font-black text-red-700">
                        {lang === 'en' ? 'First check-in:' : 'První odbavení:'}{' '}
                        {new Date(result.ticket.firstCheckedInAt).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {result.error ? <div className="text-sm font-bold">{result.error}</div> : null}

                {canCheckIn ? (
                  <button
                    type="button"
                    onClick={performCheckIn}
                    disabled={checkInLoading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white disabled:opacity-60"
                  >
                    {checkInLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {lang === 'en' ? 'Check in / admit' : 'Odbavit / vpustit'}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
