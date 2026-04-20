'use client';

import React, { useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Ticket, X, Download, Send } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/app/context/ToastContext';
import TicketModal from './TicketModal';
import InvoiceRequestModal from './InvoiceRequestModal';
import RefundRequestModal from './RefundRequestModal';

type RSVP = {
  id: string;
  event_id: string;
  status: string | null;
  created_at: string | null;
  qr_code: string | null;
  expires_at?: string | null;
  attendees?: any[] | null;
  payment_method?: string | null;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
};

function formatIcsDate(dt: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(
    dt.getUTCMinutes()
  )}${pad(dt.getUTCSeconds())}Z`;
}

function buildIcs(events: any[]) {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pupen//Member Calendar//CS',
    'CALSCALE:GREGORIAN',
  ];
  const footer = ['END:VCALENDAR'];

  const body = events.flatMap((e) => {
    const start = e.start as Date;
    const end = e.end as Date;
    const uid = e.uid as string;
    const summary = e.summary as string;
    const description = e.description as string;
    const location = e.location as string;
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${summary.replace(/\n/g, ' ')}`,
      location ? `LOCATION:${location.replace(/\n/g, ' ')}` : '',
      description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
      'END:VEVENT',
    ].filter(Boolean);
  });

  return [...header, ...body, ...footer].join('\r\n');
}

export default function MyEventsTab({ lang, userEmail }: { lang: string; userEmail: string }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [ticketOpen, setTicketOpen] = useState<null | { title: string; token: string; status: string | null; expiresAt: string | null }>(null);
  const [invoiceOpen, setInvoiceOpen] = useState<null | { rsvpId: string; eventId: string; eventTitle: string; email: string; name: string }>(null);
  const [refundOpen, setRefundOpen] = useState<any | null>(null);
  const [resendId, setResendId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['member_rsvp', userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const rsvpRes = await supabase
        .from('rsvp')
        .select('id, event_id, status, created_at, qr_code, expires_at, attendees, payment_method, name, checked_in, checked_in_at')
        .eq('email', userEmail)
        .order('created_at', { ascending: false });

      if (rsvpRes.error) throw rsvpRes.error;
      const rsvps = (rsvpRes.data || []) as RSVP[];

      const ids = Array.from(new Set(rsvps.map((r) => r.event_id).filter(Boolean)));
      const eventsRes =
        ids.length === 0
          ? { data: [] as any[], error: null as any }
          : await supabase
              .from('events')
              .select('id, title, title_en, date, time, location, category')
              .in('id', ids);

      if ((eventsRes as any).error) throw (eventsRes as any).error;
      const events = (eventsRes as any).data || [];

      const byId = new Map(events.map((e: any) => [String(e.id), e]));
      const merged = rsvps.map((r) => ({
        ...r,
        event: byId.get(String(r.event_id)) || null,
      }));

      return merged;
    },
  });

  const rows = useMemo(() => data || [], [data]);

  const counts = useMemo(() => {
    const now = new Date();
    let attended = 0;
    let upcoming = 0;
    let total = 0;
    for (const r of rows as any[]) {
      total += 1;
      if (r?.checked_in === true) attended += 1;
      const d = r?.event?.date ? new Date(String(r.event.date)) : null;
      if (d && !Number.isNaN(d.getTime()) && d >= now && r?.status !== 'cancelled') upcoming += 1;
    }
    return { total, attended, upcoming };
  }, [rows]);

  const resendTicket = async (row: any) => {
    setResendId(row.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const email = session.session?.user?.email;
      const name = row?.name || '';
      const eventTitle = row?.event?.title || '';

      if (!email || !row?.qr_code || !eventTitle) {
        showToast(lang === 'en' ? 'Missing data' : 'Chybí data', 'error');
        return;
      }

      await fetch('/api/admin/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || email,
          eventTitle,
          attendees: row.attendees || [{ name: name || email }],
          paymentMethod: row.payment_method || 'hotove',
          qrToken: row.qr_code,
          status: row.status || 'confirmed',
        }),
      });

      showToast(lang === 'en' ? 'Ticket email sent' : 'E-mail se vstupenkou odeslán', 'success');
    } catch {
      showToast(lang === 'en' ? 'Send failed' : 'Odeslání se nezdařilo', 'error');
    } finally {
      setResendId(null);
    }
  };

  const upcomingForIcs = useMemo(() => {
    const now = new Date();
    return rows
      .filter((r: any) => r.event?.date && (r.status === 'confirmed' || r.status === 'reserved'))
      .map((r: any) => {
        const dateStr = r.event.date as string;
        const timeStr = (r.event.time as string) || '00:00';
        const [hh, mm] = timeStr.split(':').map((x: string) => Number(x));
        const start = new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        return {
          uid: `${r.id}@pupen`,
          start,
          end,
          summary: r.event.title,
          description: `RSVP: ${r.id}`,
          location: r.event.location || '',
        };
      })
      .filter((e: any) => e.start instanceof Date && !Number.isNaN(e.start.getTime()) && e.start >= now)
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());
  }, [rows]);

  const downloadIcs = () => {
    const ics = buildIcs(upcomingForIcs);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pupen-moje-akce.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const cancelRsvp = async (id: string) => {
    setCancelLoading(true);
    try {
      const { error } = await supabase.from('rsvp').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      showToast(lang === 'en' ? 'Registration cancelled' : 'Registrace zrušena', 'success');
      await qc.invalidateQueries({ queryKey: ['member_rsvp', userEmail] });
    } catch {
      showToast(lang === 'en' ? 'Cancellation failed' : 'Zrušení se nezdařilo', 'error');
    } finally {
      setCancelLoading(false);
      setCancelId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <RefundRequestModal open={!!refundOpen} onClose={() => setRefundOpen(null)} lang={lang} rsvp={refundOpen} />
      <TicketModal
        open={!!ticketOpen}
        onClose={() => setTicketOpen(null)}
        lang={lang}
        title={ticketOpen?.title || ''}
        qrToken={ticketOpen?.token || ''}
        status={ticketOpen?.status || null}
        expiresAt={ticketOpen?.expiresAt || null}
      />
      <InvoiceRequestModal
        open={!!invoiceOpen}
        onClose={() => setInvoiceOpen(null)}
        lang={lang}
        rsvpId={invoiceOpen?.rsvpId || ''}
        eventId={invoiceOpen?.eventId || ''}
        eventTitle={invoiceOpen?.eventTitle || ''}
        email={invoiceOpen?.email || userEmail}
        defaultName={invoiceOpen?.name || userEmail}
      />
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <Ticket className="text-green-600" /> {lang === 'en' ? 'My events' : 'Moje akce'}
            </h2>
            <p className="text-stone-500 font-medium mt-2">
              {lang === 'en'
                ? 'Your registrations and calendar export.'
                : 'Vaše registrace (RSVP) a export do kalendáře.'}
            </p>
          </div>
          <button
            type="button"
            onClick={downloadIcs}
            disabled={upcomingForIcs.length === 0}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
          >
            <Download size={16} />
            {lang === 'en' ? 'Download .ics' : 'Stáhnout .ics'}
          </button>
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {lang === 'en' ? 'Total' : 'Celkem'}
            </div>
            <div className="mt-1 text-2xl font-black text-stone-900">{counts.total}</div>
          </div>
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {lang === 'en' ? 'Attended (check-in)' : 'Účast (check-in)'}
            </div>
            <div className="mt-1 text-2xl font-black text-stone-900">{counts.attended}</div>
          </div>
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {lang === 'en' ? 'Upcoming' : 'Nadcházející'}
            </div>
            <div className="mt-1 text-2xl font-black text-stone-900">{counts.upcoming}</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[3rem] border border-stone-100 shadow-sm">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            {lang === 'en' ? 'No registrations yet.' : 'Zatím žádné registrace.'}
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r: any) => (
              <div key={r.id} className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xl font-black text-stone-900 truncate">
                      {lang === 'en' && r.event?.title_en ? r.event.title_en : r.event?.title || '---'}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-stone-500 text-sm font-medium">
                      {r.event?.date && (
                        <span className="inline-flex items-center gap-2 bg-white border border-stone-100 px-3 py-2 rounded-xl">
                          <Calendar size={16} className="text-green-600" />
                          {new Date(r.event.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                        </span>
                      )}
                      {r.event?.time && (
                        <span className="inline-flex items-center gap-2 bg-white border border-stone-100 px-3 py-2 rounded-xl">
                          <Clock size={16} className="text-green-600" />
                          {r.event.time}
                        </span>
                      )}
                      {r.event?.location && (
                        <span className="inline-flex items-center gap-2 bg-white border border-stone-100 px-3 py-2 rounded-xl">
                          <MapPin size={16} className="text-green-600" />
                          {r.event.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                        r.status === 'cancelled'
                          ? 'bg-stone-200 text-stone-700'
                          : r.status === 'waitlist'
                            ? 'bg-amber-100 text-amber-700'
                            : r.status === 'reserved'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {r.status === 'cancelled'
                        ? lang === 'en'
                          ? 'Cancelled'
                          : 'Zrušeno'
                        : r.status === 'waitlist'
                          ? lang === 'en'
                            ? 'Waitlist'
                            : 'Čekací listina'
                          : r.status === 'reserved'
                            ? lang === 'en'
                              ? 'Reserved'
                              : 'Rezervováno'
                            : lang === 'en'
                              ? 'Confirmed'
                              : 'Potvrzeno'}
                    </span>

                    {r.checked_in === true && (
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700">
                        {lang === 'en' ? 'Checked in' : 'Odbaveno'}
                      </span>
                    )}

                    {r.status !== 'cancelled' && (
                      <div className="flex items-center gap-2">
                        {r.qr_code && (
                          <button
                            type="button"
                            onClick={() =>
                              setTicketOpen({
                                title: lang === 'en' && r.event?.title_en ? r.event.title_en : r.event?.title || '---',
                                token: r.qr_code,
                                status: r.status,
                                expiresAt: r.expires_at || null,
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                          >
                            <Ticket size={16} />
                            {lang === 'en' ? 'Ticket' : 'Vstupenka'}
                          </button>
                        )}
                        {(r.status === 'confirmed' || r.status === 'reserved') && (
                          <button
                            type="button"
                            onClick={() =>
                              setInvoiceOpen({
                                rsvpId: r.id,
                                eventId: r.event_id,
                                eventTitle: lang === 'en' && r.event?.title_en ? r.event.title_en : r.event?.title || '---',
                                email: userEmail,
                                name: (r as any).name || userEmail,
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                          >
                            {lang === 'en' ? 'Invoice' : 'Faktura'}
                          </button>
                        )}
                        {(r.status === 'confirmed' || r.status === 'reserved') && (
                          <button
                            type="button"
                            onClick={() => setRefundOpen(r)}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                          >
                            {lang === 'en' ? 'Refund' : 'Refund'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => resendTicket(r)}
                          disabled={!r.qr_code || resendId === r.id}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                        >
                          {resendId === r.id ? <InlinePulse className="bg-stone-300" size={12} /> : <Send size={16} />}
                          {lang === 'en' ? 'Resend' : 'Znovu poslat'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelId(r.id)}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                        >
                          <X size={16} />
                          {lang === 'en' ? 'Cancel' : 'Zrušit'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {cancelId === r.id && (
                  <div className="mt-5 bg-white border border-stone-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-sm font-bold text-stone-700">
                      {lang === 'en' ? 'Cancel this registration?' : 'Zrušit tuto registraci?'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCancelId(null)}
                        disabled={cancelLoading}
                        className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                      >
                        {lang === 'en' ? 'Back' : 'Zpět'}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelRsvp(r.id)}
                        disabled={cancelLoading}
                        className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-red-200 bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {cancelLoading && <InlinePulse className="bg-white/80" size={12} />}
                        {lang === 'en' ? 'Confirm' : 'Potvrdit'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
