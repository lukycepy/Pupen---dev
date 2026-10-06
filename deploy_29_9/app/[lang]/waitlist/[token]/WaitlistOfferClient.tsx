'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Mail, Ticket, XCircle } from 'lucide-react';

type WaitlistOfferResponse = {
  ok?: boolean;
  offerStatus?: string;
  error?: string;
  offer?: {
    id: string;
    eventId: string;
    rsvpId: string;
    eventTitle: string;
    name: string;
    email: string;
    attendees: Array<{ name?: string }>;
    priceTotal: number;
    pricingLabel: string;
    variableSymbol: string;
    paymentMethod: string;
    expiresAt: string;
    claimedAt: string | null;
    status: string;
  } | null;
};

function statusInfo(status: string, lang: 'cs' | 'en') {
  if (status === 'pending') {
    return {
      icon: Clock3,
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      title: lang === 'en' ? 'Spot reserved for you' : 'Místo je rezervované pro vás',
      description:
        lang === 'en'
          ? 'Use the button below to complete the registration before the offer expires.'
          : 'Pomocí tlačítka níže dokončete registraci dříve, než nabídka vyprší.',
    };
  }
  if (status === 'claimed') {
    return {
      icon: CheckCircle2,
      className: 'border-green-200 bg-green-50 text-green-900',
      title: lang === 'en' ? 'Registration completed' : 'Registrace dokončena',
      description:
        lang === 'en'
          ? 'Your place has been confirmed. Follow the payment instructions in your email if needed.'
          : 'Vaše místo bylo potvrzeno. Pokud je potřeba platba, řiďte se instrukcemi v e-mailu.',
    };
  }
  if (status === 'expired') {
    return {
      icon: XCircle,
      className: 'border-red-200 bg-red-50 text-red-900',
      title: lang === 'en' ? 'Offer expired' : 'Nabídka vypršela',
      description:
        lang === 'en'
          ? 'The time window has ended and the place may already have been offered to another person.'
          : 'Časové okno skončilo a místo už může být nabídnuto dalšímu náhradníkovi.',
    };
  }
  if (status === 'cancelled') {
    return {
      icon: XCircle,
      className: 'border-red-200 bg-red-50 text-red-900',
      title: lang === 'en' ? 'Offer cancelled' : 'Nabídka zrušena',
      description:
        lang === 'en'
          ? 'This offer is no longer valid.'
          : 'Tato nabídka už není platná.',
    };
  }
  return {
    icon: AlertTriangle,
    className: 'border-red-200 bg-red-50 text-red-900',
    title: lang === 'en' ? 'Invalid link' : 'Neplatný odkaz',
    description:
      lang === 'en'
        ? 'The waitlist offer could not be found.'
        : 'Waitlist nabídku se nepodařilo dohledat.',
  };
}

export default function WaitlistOfferClient({ lang, token }: { lang: 'cs' | 'en'; token: string }) {
  const [state, setState] = useState<WaitlistOfferResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/rsvp/waitlist-offer?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`);
      const json = await resp.json().catch(() => ({}));
      setState(json);
    } catch (error) {
      setState({ ok: false, offerStatus: 'invalid', error: error instanceof Error ? error.message : 'Error' });
    } finally {
      setLoading(false);
    }
  }, [lang, token]);

  useEffect(() => {
    load();
  }, [load]);

  const claim = useCallback(async () => {
    setClaiming(true);
    try {
      const resp = await fetch('/api/rsvp/waitlist-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, lang }),
      });
      const json = await resp.json().catch(() => ({}));
      setState(json);
    } catch (error) {
      setState((prev) => ({ ...(prev || {}), error: error instanceof Error ? error.message : 'Error' }));
    } finally {
      setClaiming(false);
    }
  }, [lang, token]);

  const meta = useMemo(() => statusInfo(state?.offerStatus || 'invalid', lang), [lang, state?.offerStatus]);
  const Icon = meta.icon;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-stone-400">
            {lang === 'en' ? 'Waitlist' : 'Čekací listina'}
          </div>
          <h1 className="mt-3 text-3xl font-black text-stone-900">
            {lang === 'en' ? 'Complete your registration' : 'Dokončete registraci'}
          </h1>
        </div>

        {loading ? (
          <section className="rounded-[2rem] border border-stone-100 bg-white p-8 shadow-sm text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-green-600" />
          </section>
        ) : (
          <section className={`rounded-[2rem] border p-6 shadow-sm ${meta.className}`}>
            <div className="flex items-start gap-4">
              <Icon className="mt-1 h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
                  {lang === 'en' ? 'Offer status' : 'Stav nabídky'}
                </div>
                <h2 className="mt-1 text-2xl font-black">{meta.title}</h2>
                <p className="mt-2 text-sm font-bold opacity-85">{meta.description}</p>

                {state?.offer ? (
                  <div className="mt-5 rounded-[1.5rem] border border-current/10 bg-white/70 p-5 text-stone-900">
                    <div className="text-lg font-black">{state.offer.eventTitle}</div>
                    <div className="mt-2 text-sm font-bold">
                      {state.offer.name || state.offer.email}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs font-bold text-stone-600">
                      <Mail size={14} />
                      {state.offer.email}
                    </div>
                    {state.offer.attendees?.length ? (
                      <div className="mt-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                          {lang === 'en' ? 'Attendees' : 'Účastníci'}
                        </div>
                        <div className="mt-2 space-y-1 text-sm font-bold text-stone-700">
                          {state.offer.attendees.map((attendee, index) => (
                            <div key={`${attendee.name || 'attendee'}-${index}`}>{attendee.name || `${lang === 'en' ? 'Attendee' : 'Účastník'} ${index + 1}`}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-stone-600">
                      <Ticket size={14} />
                      {state.offer.priceTotal > 0 ? `${state.offer.priceTotal.toFixed(2)} CZK` : lang === 'en' ? 'Free registration' : 'Registrace zdarma'}
                      {state.offer.pricingLabel ? ` • ${state.offer.pricingLabel}` : ''}
                      {state.offer.variableSymbol ? ` • VS ${state.offer.variableSymbol}` : ''}
                    </div>
                    <div className="mt-3 text-xs font-black text-stone-700">
                      {lang === 'en' ? 'Valid until:' : 'Platí do:'}{' '}
                      {state.offer.expiresAt ? new Date(state.offer.expiresAt).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ') : '—'}
                    </div>
                  </div>
                ) : null}

                {state?.error ? <div className="mt-4 text-sm font-bold">{state.error}</div> : null}

                {state?.offerStatus === 'pending' ? (
                  <button
                    type="button"
                    onClick={claim}
                    disabled={claiming}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white disabled:opacity-60"
                  >
                    {claiming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {lang === 'en' ? 'Confirm my place' : 'Potvrdit moje místo'}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        )}

        <div className="text-center">
          <Link href={`/${lang}/akce`} className="text-sm font-black text-green-700 underline underline-offset-4">
            {lang === 'en' ? 'Back to events' : 'Zpět na akce'}
          </Link>
        </div>
      </div>
    </main>
  );
}
