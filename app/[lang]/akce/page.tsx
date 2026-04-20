'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/get-dictionary';
import { Clock, ArrowRight, Calendar, CheckCircle, LayoutGrid, CalendarDays, Users, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Dialog from '@/app/components/ui/Dialog';
import MonthlyCalendar from '../components/MonthlyCalendar';
import InlinePulse from '@/app/components/InlinePulse';
import SocialShareMenu from '@/app/components/SocialShareMenu';
import CopyButton from '@/app/components/CopyButton';

const RSVP_DRAFT_KEY = 'pupen_rsvp_draft_v1';
const passthroughLoader = ({ src }: { src: string }) => src;

function stripHtmlToText(s: string) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEventExcerpt(ev: any, lang: string) {
  const raw = lang === 'en' && ev?.description_en ? ev.description_en : ev?.description;
  const html = lang === 'en' && ev?.description_html_en ? ev.description_html_en : ev?.description_html;
  const base = raw || html || '';
  const str = String(base || '');
  return str.includes('<') ? stripHtmlToText(str) : str;
}

export default function AkcePage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const router = useRouter();
  const isSafeImageSrc = (value: unknown) => {
    if (typeof value !== 'string') return false;
    if (!value) return false;
    if (value.startsWith('/')) return true;
    return /^https?:\/\//.test(value);
  };
  const { showToast } = useToast();

  const [events, setEvents] = useState<any[]>([]);
  const [dict, setDict] = useState<any>(null);
  const [globalDict, setGlobalDict] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState("Vše");
  const [viewMode, setActiveViewMode] = useState<'list' | 'calendar'>('calendar');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'public' | 'members'>('all');

  // RSVP state
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [rsvpCancelLoading, setRsvpCancelLoading] = useState(false);
  const [rsvpOpen, setRsvpOpen] = useState<string | null>(null);
  const [rsvpView, setRsvpView] = useState<'form' | 'success'>('form');
  const [rsvpResult, setRsvpResult] = useState<null | {
    eventId: string;
    status: string;
    qrToken: string;
    expiresAt: string | null;
    attendeesCount: number;
  }>(null);
  const [rsvpForm, setRsvpForm] = useState({ 
    name: '', 
    email: '',
    promo_code: '',
    subscribe_newsletter: false,
    payment_method: 'hotove',
    attendeesCount: 1,
    attendees: [{ name: '' }],
  });

  const readDrafts = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(RSVP_DRAFT_KEY);
      return raw ? (JSON.parse(raw) as Record<string, any>) : {};
    } catch {
      return {};
    }
  }, []);

  const writeDraft = useCallback((eventId: string, draft: any) => {
    try {
      const drafts = readDrafts();
      drafts[eventId] = draft;
      window.localStorage.setItem(RSVP_DRAFT_KEY, JSON.stringify(drafts));
    } catch {}
  }, [readDrafts]);

  const clearDraft = (eventId: string) => {
    try {
      const drafts = readDrafts();
      delete drafts[eventId];
      window.localStorage.setItem(RSVP_DRAFT_KEY, JSON.stringify(drafts));
    } catch {}
  };

  const setRsvpFormWithDraft = (next: any, eventId: string | null) => {
    setRsvpForm(next);
    if (eventId) writeDraft(eventId, next);
  };

  const setAttendeesCount = (count: number) => {
    const c = Math.max(1, Math.min(3, Math.floor(Number(count) || 1)));
    const nextAttendees = Array.from({ length: c }).map((_, i) => ({ name: rsvpForm.attendees?.[i]?.name || '' }));
    const next = { ...rsvpForm, attendeesCount: c, attendees: nextAttendees };
    setRsvpFormWithDraft(next, rsvpOpen);
  };

  const updateAttendee = (index: number, name: string) => {
    const newAttendees = [...(rsvpForm.attendees || [])];
    if (!newAttendees[index]) newAttendees[index] = { name: '' };
    newAttendees[index].name = name;
    const next = { ...rsvpForm, attendees: newAttendees };
    setRsvpFormWithDraft(next, rsvpOpen);
  };

  useEffect(() => {
    if (!rsvpOpen) return;
    setRsvpView('form');
    setRsvpResult(null);
    const drafts = readDrafts();
    const draft = drafts[rsvpOpen];
    if (draft && typeof draft === 'object') {
      setRsvpForm(draft);
    }
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const session = data.session;
        if (!session?.user) return;
        const email = session.user.email;
        if (email) {
          setRsvpForm((prev) => {
            if (prev.email) return prev;
            const next = { ...prev, email };
            writeDraft(rsvpOpen, next);
            return next;
          });
        }
        const meta: any = session.user.user_metadata || {};
        const metaName = String(meta.full_name || meta.name || '').trim();
        const metaFirst = String(meta.first_name || meta.given_name || '').trim();
        const metaLast = String(meta.last_name || meta.family_name || '').trim();
        const name = metaName || [metaFirst, metaLast].filter(Boolean).join(' ').trim();
        if (name && name.length <= 120) {
          setRsvpForm((prev) => {
            if (prev.name) return prev;
            const next = { ...prev, name };
            writeDraft(rsvpOpen, next);
            return next;
          });
        }
      })
      .catch(() => {});
  }, [rsvpOpen, readDrafts, writeDraft]);

  useEffect(() => {
    async function loadPageData() {
      try {
        const dictionary = await getDictionary(lang);
        setGlobalDict(dictionary);
        const eventsDict = (dictionary as any)?.eventsPage;
        if (eventsDict) setDict(eventsDict);

        const nowIso = new Date().toISOString();
        const now = new Date();
        const run = (withMemberFilter: boolean, withArchiveFilter: boolean) => {
          let q = supabase
            .from('events')
            .select('*, rsvp(id, status, expires_at, attendees)')
            .lte('published_at', nowIso);
          if (withArchiveFilter) q = q.is('archived_at', null);
          q = q.order('date', { ascending: true });
          if (withMemberFilter) q = q.eq('is_member_only', false);
          return q;
        };
        let { data, error: supabaseError } = await run(true, true);
        if (supabaseError && /archived_at/i.test(supabaseError.message) && /schema cache|does not exist|column/i.test(supabaseError.message)) {
          const retry = await run(true, false);
          data = retry.data;
          supabaseError = retry.error;
        }
        if (supabaseError && /is_member_only/i.test(supabaseError.message) && /schema cache/i.test(supabaseError.message)) {
          const retry = await run(false, true);
          data = retry.data;
          supabaseError = retry.error;
        }
        
        if (supabaseError) throw supabaseError;

        // Clean up expired reservations (only for the view, real cleanup should be a cron/edge function)
        const activeEvents = (data || []).map((ev: any) => ({
          ...ev,
          rsvp: ev.rsvp?.filter((r: any) => {
            if (r.status === 'cancelled') return false;
            if (!r.expires_at) return true;
            return new Date(r.expires_at) > now;
          })
        }));

        const eventsWithCounts = activeEvents.map((ev: any) => ({
          ...ev,
          confirmed_count:
            ev.rsvp?.filter((r: any) => r.status === 'confirmed' || r.status === 'reserved').reduce((acc: number, r: any) => {
              const n = Array.isArray(r.attendees) ? r.attendees.length : 1;
              return acc + n;
            }, 0) || 0,
          is_full:
            ev.capacity
              ? (ev.rsvp?.filter((r: any) => r.status === 'confirmed' || r.status === 'reserved').reduce((acc: number, r: any) => {
                  const n = Array.isArray(r.attendees) ? r.attendees.length : 1;
                  return acc + n;
                }, 0) || 0) >= ev.capacity
              : false
        }));

        setEvents(eventsWithCounts);

        const params = new URLSearchParams(window.location.search);
        if (params.get('rsvp') === '1' && window.location.hash?.startsWith('#event-')) {
          const eventId = window.location.hash.replace('#event-', '');
          const found = (eventsWithCounts || []).find((e: any) => String(e.id) === String(eventId));
          if (found && Number(found.capacity || 0) > 0) setRsvpOpen(eventId);
        }
      } catch (err: any) {
        console.error("Chyba při načítání dat:", err?.message || err);
      }
    }
    loadPageData();
  }, [lang]);

  const handleRSVP = async (eventId: string) => {
    const name = rsvpForm.name.trim();
    const email = rsvpForm.email.trim();
    const promoCode = (rsvpForm as any).promo_code ? String((rsvpForm as any).promo_code).trim() : '';
    const attendeeNames = (rsvpForm.attendees || []).slice(0, Math.max(1, Math.min(3, Number(rsvpForm.attendeesCount || 1)))).map((a) => ({
      name: String((a as any)?.name || '').trim(),
    }));
    const requestedCount = Math.max(1, Math.min(3, Number(rsvpForm.attendeesCount || attendeeNames.length || 1)));
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !emailOk) {
      showToast(lang === 'en' ? 'Please fill in all required fields.' : 'Vyplňte prosím všechna povinná pole.', 'error');
      return;
    }
    if (promoCode && promoCode.length > 40) {
      showToast(lang === 'en' ? 'Promo code is too long.' : 'Promo kód je příliš dlouhý.', 'error');
      return;
    }
    setRsvpLoading(eventId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch('/api/rsvp/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          eventId,
          name,
          email,
          attendees: attendeeNames,
          attendeesCount: requestedCount,
          payment_method: rsvpForm.payment_method,
          promoCode,
          subscribeNewsletter: !!(rsvpForm as any).subscribe_newsletter,
          lang,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = String(json?.error_code || json?.error || '');
        if (res.status === 409) {
          showToast(lang === 'en' ? 'You are already registered for this event.' : 'Na tuto akci už jste registrovaný/á.', 'info');
          return;
        }
        if (res.status === 401) {
          showToast(lang === 'en' ? 'Members only. Please log in.' : 'Pouze pro členy. Přihlaste se.', 'error');
          return;
        }
        if (res.status === 403) {
          if (code === 'RSVP_BLACKLISTED') {
            showToast(lang === 'en' ? 'Registration is not available.' : 'Registrace není dostupná.', 'error');
          } else {
            showToast(lang === 'en' ? 'Members only.' : 'Pouze pro členy.', 'error');
          }
          return;
        }
        if (res.status === 429) {
          showToast(lang === 'en' ? 'Too many attempts. Try later.' : 'Příliš mnoho pokusů. Zkuste později.', 'error');
          return;
        }
        if (res.status === 400 && code.startsWith('PROMO_')) {
          const msg =
            code === 'PROMO_INVALID'
              ? lang === 'en'
                ? 'Invalid promo code.'
                : 'Neplatný promo kód.'
              : code === 'PROMO_INACTIVE'
                ? lang === 'en'
                  ? 'Promo code is inactive.'
                  : 'Promo kód není aktivní.'
                : code === 'PROMO_NOT_STARTED'
                  ? lang === 'en'
                    ? 'Promo code is not active yet.'
                    : 'Promo kód ještě neplatí.'
                  : code === 'PROMO_ENDED'
                    ? lang === 'en'
                      ? 'Promo code has expired.'
                      : 'Platnost promo kódu skončila.'
                    : code === 'PROMO_NOT_FOR_EVENT'
                      ? lang === 'en'
                        ? 'Promo code is not valid for this event.'
                        : 'Promo kód neplatí pro tuto akci.'
                      : code === 'PROMO_EXHAUSTED'
                        ? lang === 'en'
                          ? 'Promo code usage limit reached.'
                          : 'Promo kód je vyčerpaný.'
                        : code === 'PROMO_LIMIT_EMAIL'
                          ? lang === 'en'
                            ? 'Promo code limit reached for this email.'
                            : 'Promo kód už byl pro tento e-mail použit.'
                          : code === 'PROMO_NOT_ALLOWED_EMAIL'
                            ? lang === 'en'
                              ? 'Promo code is not available for this email.'
                              : 'Promo kód není dostupný pro tento e-mail.'
                          : code === 'PROMO_TOO_LONG'
                            ? lang === 'en'
                              ? 'Promo code is too long.'
                              : 'Promo kód je příliš dlouhý.'
                          : lang === 'en'
                            ? 'Promo code is not valid.'
                            : 'Promo kód není platný.';
          showToast(msg, 'error');
          return;
        }
        if (res.status === 400 && code === 'RSVP_CLOSED') {
          showToast(lang === 'en' ? 'Registration is closed.' : 'Registrace je uzavřena.', 'error');
          return;
        }
        if (res.status === 400 && code === 'RSVP_MEMBER_EMAIL_MISMATCH') {
          showToast(lang === 'en' ? 'Use your member email address.' : 'Použijte svůj členský e-mail.', 'error');
          return;
        }
        if (res.status === 400 && (code === 'RSVP_BAD_INPUT' || code === 'RSVP_INVALID_ATTENDEES')) {
          showToast(lang === 'en' ? 'Please fill in all required fields.' : 'Vyplňte prosím všechna povinná pole.', 'error');
          return;
        }
        throw new Error(json?.error || 'Request failed');
      }

      const status = json.status;
      const qr_token = json.qrToken;
      const expiresAt = json.expiresAt || null;

      if (status === 'waitlist') {
        showToast(lang === 'cs' ? 'Kapacita naplněna. Jste na čekací listině!' : 'Capacity full. You are on the waitlist!', 'warning');
      } else if (status === 'reserved') {
        showToast(lang === 'cs' ? 'Rezervace vytvořena. Čeká na platbu.' : 'Reservation created. Waiting for payment.', 'info');
      } else {
        showToast(globalDict?.eventsPage?.rsvpSuccess || 'Díky! Těšíme se.', 'success');
      }

      setEvents((prev) =>
        prev.map((ev: any) => {
          if (String(ev.id) !== String(eventId)) return ev;
          const add = status === 'confirmed' || status === 'reserved' ? requestedCount : 0;
          const nextCount = (ev.confirmed_count || 0) + add;
          return { ...ev, confirmed_count: nextCount, is_full: ev.capacity ? nextCount >= ev.capacity : false };
        })
      );

      clearDraft(eventId);
      setRsvpResult({ eventId, status, qrToken: qr_token, expiresAt, attendeesCount: requestedCount });
      setRsvpView('success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setRsvpLoading(null);
    }
  };

  const cancelRsvp = async () => {
    if (!rsvpResult?.eventId || !rsvpResult?.qrToken) return;
    const email = String(rsvpForm.email || '').trim();
    if (!email) {
      showToast(lang === 'en' ? 'Missing email.' : 'Chybí e-mail.', 'error');
      return;
    }
    setRsvpCancelLoading(true);
    try {
      const res = await fetch('/api/rsvp/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: rsvpResult.eventId, email, token: rsvpResult.qrToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      showToast(lang === 'en' ? 'Registration cancelled.' : 'Registrace zrušena.', 'success');
      setEvents((prev) =>
        prev.map((ev: any) => {
          if (String(ev.id) !== String(rsvpResult.eventId)) return ev;
          const sub = rsvpResult.status === 'confirmed' || rsvpResult.status === 'reserved' ? Number(rsvpResult.attendeesCount || 1) : 0;
          const nextCount = Math.max(0, (ev.confirmed_count || 0) - sub);
          return { ...ev, confirmed_count: nextCount, is_full: ev.capacity ? nextCount >= ev.capacity : false };
        }),
      );
      setRsvpOpen(null);
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
    } finally {
      setRsvpCancelLoading(false);
    }
  };

  const addToCalendar = (event: any) => {
    const title = lang === 'en' && event.title_en ? event.title_en : event.title;
    const desc = lang === 'en' && event.description_en ? event.description_en : event.description;
    const start = new Date(`${event.date}T${event.time || '00:00'}:00`).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(new Date(`${event.date}T${event.time || '00:00'}:00`).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(desc)}&location=${encodeURIComponent(event.location || "")}`;
    window.open(url, '_blank');
  };

  const buildEventShareUrl = (eventId: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/${lang}/akce/${eventId}`;
  };

  const toYmd = (v: any) => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const filteredEvents = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    return (events || []).filter((e: any) => {
      const catOk = activeCategory === 'Vše' ? true : String(e.category || '') === String(activeCategory);
      const audOk =
        audienceFilter === 'all' ? true : audienceFilter === 'public' ? !e.is_member_only : !!e.is_member_only;
      const qOk = !q
        ? true
        : `${String(e.title || '')} ${String(e.excerpt || '')} ${String(e.description || '')}`
            .toLowerCase()
            .includes(q);
      return catOk && audOk && qOk;
    });
  }, [events, activeCategory, audienceFilter, searchQuery]);

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const monthKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
  const monthName = calendarDate.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US', { month: 'long' });
  const monthFilteredEvents = filteredEvents.filter((e) => toYmd(e.date).slice(0, 7) === monthKey);
  const todayKey = toYmd(new Date());
  const futureEvents = filteredEvents.filter((e) => toYmd(e.date) >= todayKey);

  const categoryKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of events || []) {
      const c = String(e?.category || '').trim();
      if (c) set.add(c);
    }
    const dynamic = Array.from(set).sort((a, b) => a.localeCompare(b, lang === 'en' ? 'en' : 'cs'));
    return ['Vše', ...dynamic];
  }, [events, lang]);

  if (!dict) return null;

  return (    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-7xl mx-auto px-6">
        <header className="mb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6 shadow-sm">
                <CalendarDays size={32} />
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
              <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
            </div>

            <div className="flex items-center gap-3">
              {viewMode === 'calendar' && (
              <div className="hidden md:flex items-center gap-2 bg-white border border-stone-100 rounded-2xl p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1))}
                  className="p-3 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition"
                  aria-label={lang === 'en' ? 'Previous month' : 'Předchozí měsíc'}
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-stone-600">
                  {monthName} {calendarYear}
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1))}
                  className="p-3 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition"
                  aria-label={lang === 'en' ? 'Next month' : 'Další měsíc'}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              )}
              <a
                href={`/api/ical/events?lang=${lang}`}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
              >
                {lang === 'en' ? 'iCal feed' : 'Odběr iCal'}
              </a>
              <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100">
                <button 
                  onClick={() => setActiveViewMode('list')}
                  className={`p-3 rounded-xl transition ${viewMode === 'list' ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <LayoutGrid size={20} />
                </button>
                <button 
                  onClick={() => setActiveViewMode('calendar')}
                  className={`p-3 rounded-xl transition ${viewMode === 'calendar' ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <Calendar size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-2xl px-4 py-3 shadow-sm w-full md:w-[420px]">
              <Search size={16} className="text-stone-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search events…' : 'Hledat akce…'}
                className="w-full bg-transparent outline-none text-sm font-bold text-stone-700 placeholder:text-stone-400"
              />
            </div>
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setAudienceFilter('all')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${
                  audienceFilter === 'all' ? 'bg-green-600 text-white' : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                {lang === 'en' ? 'All' : 'Vše'}
              </button>
              <button
                type="button"
                onClick={() => setAudienceFilter('public')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${
                  audienceFilter === 'public' ? 'bg-green-600 text-white' : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                {lang === 'en' ? 'Public' : 'Veřejné'}
              </button>
              <button
                type="button"
                onClick={() => setAudienceFilter('members')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${
                  audienceFilter === 'members' ? 'bg-green-600 text-white' : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                {lang === 'en' ? 'Members' : 'Členské'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-12 overflow-x-auto pb-4 no-scrollbar">
            {categoryKeys.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition ${activeCategory === cat ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
              >
                {dict.categories[cat] || cat}
              </button>
            ))}
          </div>
        </header>

        {viewMode === 'calendar' ? (
          <MonthlyCalendar events={monthFilteredEvents} lang={lang} value={calendarDate} onChange={setCalendarDate} />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {futureEvents.length === 0 ? (
              <div className="col-span-full py-20 text-center text-stone-400 font-bold uppercase tracking-widest bg-white rounded-[3rem] border border-dashed border-stone-200">
                {dict.noEvents}
              </div>
            ) : (
              futureEvents.map((event) => (
                <div
                  id={`event-${event.id}`}
                  key={event.id}
                  className="bg-white rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-xl border border-stone-100 group hover:shadow-2xl transition-all duration-500 flex flex-col h-full cursor-pointer"
                  onClick={(e) => {
                    const target = e.target as HTMLElement | null;
                    if (target?.closest('button, a, input, textarea, select, label')) return;
                    router.push(`/${lang}/akce/${event.id}`);
                  }}
                >
                  <div className="aspect-video relative overflow-hidden shrink-0">
                    {isSafeImageSrc(String(event.image_url ?? '')) ? (
                      String(event.image_url).startsWith('http') ? (
                      <Image
                        loader={passthroughLoader}
                        unoptimized
                        src={String(event.image_url)}
                        alt={event.title}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-700"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        referrerPolicy="no-referrer"
                      />
                      ) : (
                      <Image
                        src={event.image_url}
                        alt={event.title}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-700"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      )
                    ) : null}
                    <div className="absolute top-4 left-4 sm:top-6 sm:left-6 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/90 backdrop-blur rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-green-600">
                      {dict.categories[event.category] || event.category}
                    </div>
                    {event.is_member_only ? (
                      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 px-3 py-1.5 sm:px-4 sm:py-2 bg-stone-900/80 backdrop-blur rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white">
                        {lang === 'en' ? 'Members' : 'Členské'}
                      </div>
                    ) : null}
                    <Link href={`/${lang}/akce/${event.id}`} className="absolute inset-0" aria-label="Detail" />
                  </div>
                  <div className="p-6 sm:p-8 md:p-10 flex flex-col flex-grow">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-stone-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-4 sm:mb-6">
                      <div className="flex items-center gap-2"><Calendar size={14} className="shrink-0" /> {new Date(event.date).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US')}</div>
                      {event.time && <div className="flex items-center gap-2"><Clock size={14} className="shrink-0" /> {event.time}</div>}
                      {event.capacity && (
                        <div className={`flex items-center gap-2 ${event.is_full ? 'text-amber-600' : 'text-stone-400'}`}>
                          <Users size={14} className="shrink-0" /> {event.confirmed_count}/{event.capacity}
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-stone-900 mb-3 sm:mb-4 group-hover:text-green-600 transition line-clamp-2 leading-tight">{lang === 'en' && event.title_en ? event.title_en : event.title}</h3>
                    <p className="text-stone-500 text-xs sm:text-sm mb-6 sm:mb-8 line-clamp-3 leading-relaxed flex-grow">{getEventExcerpt(event, lang)}</p>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-6 sm:pt-8 border-t border-stone-50 gap-4 mt-auto">
                      {event.capacity && event.capacity > 0 ? (
                        <button 
                          onClick={() => setRsvpOpen(event.id)} 
                          disabled={event.ticket_sale_end && new Date(event.ticket_sale_end) < new Date()}
                          className={`${event.is_full ? 'text-amber-600' : 'text-green-600'} font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:translate-x-1 transition-transform flex items-center justify-center sm:justify-start gap-2 py-2 sm:py-0 disabled:opacity-50`}
                        >
                          {event.ticket_sale_end && new Date(event.ticket_sale_end) < new Date() 
                            ? (lang === 'cs' ? 'Prodej ukončen' : 'Sale ended')
                            : event.is_full ? (lang === 'cs' ? 'Přidat se na čekací listinu' : 'Join waitlist') : dict.rsvpBtn} <ArrowRight size={14} />
                        </button>
                      ) : (
                        <div className="text-stone-300 font-black uppercase tracking-widest text-[9px] sm:text-[10px] py-2 sm:py-0">
                          {lang === 'cs' ? 'Vstup zdarma' : 'Free entry'}
                        </div>
                      )}
                      <div className="flex justify-center sm:justify-end gap-2">
                        <button onClick={() => addToCalendar(event)} className="p-2.5 sm:p-3 bg-stone-50 text-stone-400 rounded-lg sm:rounded-xl hover:bg-green-50 hover:text-green-600 transition flex-1 sm:flex-none flex justify-center"><Calendar size={18} /></button>
                        <SocialShareMenu
                          title={lang === 'en' && event.title_en ? event.title_en : event.title}
                          url={buildEventShareUrl(event.id)}
                        />
                        <Link
                          href={`/${lang}/akce/${event.id}`}
                          className="p-2.5 sm:p-3 bg-stone-50 text-stone-400 rounded-lg sm:rounded-xl hover:bg-green-50 hover:text-green-600 transition flex-1 sm:flex-none flex justify-center"
                          aria-label="Detail"
                        >
                          <ArrowRight size={18} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {rsvpOpen && (
          <Dialog
            open={!!rsvpOpen}
            onClose={() => setRsvpOpen(null)}
            overlayClassName="fixed inset-0 z-[10001] bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto"
            panelClassName="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300 my-8"
          >
              {rsvpView === 'success' && rsvpResult ? (
                <div>
                  <h3 className="text-2xl font-black text-stone-900 mb-2">
                    {lang === 'en' ? 'Registration created' : 'Registrace vytvořena'}
                  </h3>
                  <p className="text-stone-500 mb-8 font-medium">
                    {rsvpResult.status === 'waitlist'
                      ? (lang === 'en'
                          ? 'You are on the waitlist.'
                          : 'Jste na čekací listině.')
                      : rsvpResult.status === 'reserved'
                        ? (lang === 'en'
                            ? 'Reservation is waiting for payment.'
                            : 'Rezervace čeká na platbu.')
                        : (lang === 'en'
                            ? 'You are registered.'
                            : 'Jste registrovaný/á.')}
                  </p>

                  <div className="bg-stone-50 border border-stone-100 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                          {lang === 'en' ? 'Status' : 'Stav'}
                        </div>
                        <div className="font-black text-stone-900">
                          {String((dict?.rsvpStatus && (dict.rsvpStatus as any)[String(rsvpResult.status)]) || rsvpResult.status)}
                        </div>
                      </div>
                      {rsvpResult.expiresAt && (
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                            {lang === 'en' ? 'Valid until' : 'Platí do'}
                          </div>
                          <div className="font-bold text-stone-700">
                            {new Date(rsvpResult.expiresAt).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white border border-stone-100 rounded-2xl p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                        QR Token
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black tracking-widest text-stone-900 truncate">{rsvpResult.qrToken}</div>
                        <CopyButton value={rsvpResult.qrToken} className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-6">
                    <button
                      type="button"
                      onClick={cancelRsvp}
                      disabled={rsvpCancelLoading || rsvpLoading === rsvpOpen}
                      className="w-full bg-white border border-stone-200 text-stone-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      {rsvpCancelLoading ? <InlinePulse className="bg-stone-400/70" size={14} /> : null}
                      {lang === 'en' ? 'Cancel registration' : 'Zrušit registraci'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRsvpOpen(null);
                        setRsvpView('form');
                        setRsvpResult(null);
                        setRsvpForm({ name: '', email: '', promo_code: '', subscribe_newsletter: false, payment_method: 'hotove', attendeesCount: 1, attendees: [{ name: '' }] });
                      }}
                      className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100 outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {lang === 'en' ? 'Done' : 'Hotovo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-black text-stone-900 mb-2">{dict.rsvpTitle}</h3>
                  <p className="text-stone-500 mb-8 font-medium">{dict.rsvpSub || (lang === 'cs' ? 'Zadej údaje pro rezervaci vstupenek.' : 'Enter details for ticket reservation.')}</p>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kontaktní jméno</label>
                        <input 
                          type="text"
                          required
                          aria-invalid={rsvpForm.name.trim() ? 'false' : 'true'}
                          placeholder={globalDict?.contactPage?.labelName || (lang === 'cs' ? 'Jméno' : 'Name')} 
                          value={rsvpForm.name} 
                          onChange={e => setRsvpFormWithDraft({ ...rsvpForm, name: e.target.value }, rsvpOpen)} 
                          className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kontaktní e‑mail</label>
                        <input 
                          type="email"
                          required
                          aria-invalid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rsvpForm.email.trim()) ? 'false' : 'true'}
                          placeholder="Email" 
                          value={rsvpForm.email} 
                          onChange={e => setRsvpFormWithDraft({ ...rsvpForm, email: e.target.value }, rsvpOpen)} 
                          className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                            {lang === 'en' ? 'Tickets (max 3)' : 'Počet vstupenek (max 3)'}
                          </label>
                          <select
                            value={Number(rsvpForm.attendeesCount || 1)}
                            onChange={(e) => setAttendeesCount(Number(e.target.value))}
                            className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                        </div>
                      </div>
                      {Number(rsvpForm.attendeesCount || 1) > 1 ? (
                        <div className="space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                            {lang === 'en' ? 'Additional attendees (optional)' : 'Další účastníci (volitelné)'}
                          </div>
                          {Array.from({ length: Math.max(0, Number(rsvpForm.attendeesCount || 1) - 1) }).map((_, i) => (
                            <input
                              key={i}
                              type="text"
                              placeholder={lang === 'en' ? `Attendee ${i + 2}` : `Účastník ${i + 2}`}
                              value={String((rsvpForm.attendees?.[i + 1] as any)?.name || '')}
                              onChange={(e) => updateAttendee(i + 1, e.target.value)}
                              className="w-full bg-stone-50 border-none rounded-xl px-6 py-3 font-bold text-sm text-stone-700 outline-none focus:ring-2 focus:ring-green-500"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{lang === 'en' ? 'Payment method' : 'Způsob platby'}</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          type="button"
                          onClick={() => setRsvpFormWithDraft({ ...rsvpForm, payment_method: 'hotove' }, rsvpOpen)}
                          className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition outline-none focus:ring-2 focus:ring-green-500 ${rsvpForm.payment_method === 'hotove' ? 'bg-green-50 border-green-600 text-green-700' : 'bg-white border-stone-100 text-stone-400'}`}
                        >
                          {lang === 'en' ? 'Cash on site' : 'Hotově na místě'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setRsvpFormWithDraft({ ...rsvpForm, payment_method: 'prevod' }, rsvpOpen)}
                          className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition outline-none focus:ring-2 focus:ring-green-500 ${rsvpForm.payment_method === 'prevod' ? 'bg-green-50 border-green-600 text-green-700' : 'bg-white border-stone-100 text-stone-400'}`}
                        >
                          {lang === 'en' ? 'Bank transfer (QR)' : 'Převodem (QR kód)'}
                        </button>
                      </div>
                      {rsvpForm.payment_method === 'prevod' && (
                        <p className="text-[10px] text-amber-600 font-bold italic px-1">
                          * {lang === 'en' ? 'For bank transfer, the reservation is valid for 24 hours.' : 'Rezervace při platbě převodem platí 24 hodin od vytvoření.'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                        {lang === 'en' ? 'Promo code (optional)' : 'Promo kód (volitelné)'}
                      </label>
                      <input
                        type="text"
                        value={(rsvpForm as any).promo_code || ''}
                        onChange={(e) => setRsvpFormWithDraft({ ...(rsvpForm as any), promo_code: e.target.value }, rsvpOpen)}
                        className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500"
                        placeholder={lang === 'en' ? 'e.g. PUPEN2026' : 'např. PUPEN2026'}
                      />
                    </div>

                    <label className="flex items-start gap-3 bg-stone-50 border border-stone-100 rounded-2xl px-5 py-4">
                      <input
                        type="checkbox"
                        checked={!!(rsvpForm as any).subscribe_newsletter}
                        onChange={(e) => setRsvpFormWithDraft({ ...(rsvpForm as any), subscribe_newsletter: e.target.checked }, rsvpOpen)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <div className="font-black text-stone-900 text-sm">{lang === 'en' ? 'Subscribe to newsletter' : 'Chci odebírat newsletter'}</div>
                        <div className="text-xs font-bold text-stone-500">{lang === 'en' ? 'You can unsubscribe anytime.' : 'Z odběru se můžete kdykoliv odhlásit.'}</div>
                      </div>
                    </label>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setRsvpOpen(null)}
                        className="flex-grow bg-stone-100 text-stone-500 py-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {globalDict?.admin?.btnCancel || (lang === 'cs' ? 'Zrušit' : 'Cancel')}
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleRSVP(rsvpOpen)} 
                        disabled={
                          rsvpLoading === rsvpOpen ||
                          !rsvpForm.name.trim() ||
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rsvpForm.email.trim())
                        }
                        className="flex-grow bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50 outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {rsvpLoading === rsvpOpen ? <InlinePulse className="bg-white/80" size={14} /> : <CheckCircle size={20} />}
                        {dict.rsvpBtn || (lang === 'cs' ? 'Rezervovat' : 'Reserve')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </Dialog>
        )}
      </div>
    </div>
  );
}
