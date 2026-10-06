'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Calendar, Clock, FileCheck, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import InlinePulse from '@/app/components/InlinePulse';
import { useDictionary } from '@/app/context/DictionaryContext';

type Prefs = {
  categories: Record<string, boolean>;
  quietHours: { enabled: boolean; from: string; to: string };
};

const PREFS_KEY = 'pupen_notif_prefs_v1';
const READ_KEY = 'pupen_notif_read_v1';

function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return {
        categories: { events: true, payments: true, admin: true, community: true },
        quietHours: { enabled: false, from: '22:00', to: '08:00' },
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      categories: { events: true, payments: true, admin: true, community: true },
      quietHours: { enabled: false, from: '22:00', to: '08:00' },
    };
  }
}

function writePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function readReadIds(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeReadIds(ids: Record<string, boolean>) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(ids));
  } catch {}
}

export default function NotificationsTab({
  lang,
  userEmail,
}: {
  lang: string;
  userEmail: string;
}) {
  const dict = useDictionary();
  const locale = lang === 'en' ? 'en' : 'cs';
  const dateLocale = ({ cs: 'cs-CZ', en: 'en-US' } as const)[locale];
  const t = dict.memberComponents.notificationsTab;
  const applicationStatusLabel = useCallback((v: any) => {
    const s = String(v || '').trim();
    if (s === 'pending') return t.applicationPending;
    if (s === 'approved') return t.applicationApproved;
    if (s === 'rejected') return t.applicationRejected;
    return s || '—';
  }, [t.applicationApproved, t.applicationPending, t.applicationRejected]);
  const [prefs, setPrefs] = useState<Prefs>({
    categories: { events: true, payments: true, admin: true, community: true },
    quietHours: { enabled: false, from: '22:00', to: '08:00' },
  });
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const p = readPrefs();
    setPrefs(p);
    setReadIds(readReadIds());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['member_notifications', userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const [rsvpRes, appRes] = await Promise.all([
        supabase
          .from('rsvp')
          .select('id, event_id, status, created_at, expires_at, payment_method, qr_code')
          .eq('email', userEmail)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('applications').select('id, status, created_at').eq('email', userEmail).order('created_at', { ascending: false }).limit(1),
      ]);
      if (rsvpRes.error) throw rsvpRes.error;
      if (appRes.error) throw appRes.error;

      const rsvps = rsvpRes.data || [];
      const eventIds = Array.from(new Set(rsvps.map((r: any) => r.event_id).filter(Boolean)));
      const eventsRes =
        eventIds.length === 0
          ? { data: [] as any[] }
          : await supabase.from('events').select('id, title, title_en, date, time').in('id', eventIds);

      const byId = new Map((eventsRes as any).data?.map((e: any) => [String(e.id), e]) || []);
      const merged = rsvps.map((r: any) => ({ ...r, event: byId.get(String(r.event_id)) || null }));
      const application = appRes.data?.[0] || null;
      return { rsvps: merged, application };
    },
  });

  const notifications = (() => {
    const now = new Date();
    const items: Array<{
      id: string;
      createdAt: string;
      category: 'events' | 'payments' | 'admin' | 'community';
      title: string;
      body: string;
      meta?: string;
      icon: any;
    }> = [];

    const rsvps = data?.rsvps || [];
    for (const r of rsvps) {
      if (!r.status || r.status === 'cancelled') continue;
      const createdAt = r.created_at || new Date().toISOString();
      const eventTitle =
        lang === 'en' && r.event?.title_en ? r.event.title_en : r.event?.title || t.eventFallback;
      const when = r.event?.date
        ? new Date(r.event.date).toLocaleDateString(dateLocale)
        : '';
      const time = r.event?.time || '';
      const meta = [when, time].filter(Boolean).join(' • ');

      if (r.status === 'reserved') {
        const exp = r.expires_at ? new Date(r.expires_at) : null;
        const expired = exp ? exp <= now : false;
        items.push({
          id: `rsvp:${r.id}:reserved`,
          createdAt,
          category: 'payments',
          title: t.titleReservationWaiting,
          body: `${eventTitle}`,
          meta: exp
            ? `${meta}${meta ? ' • ' : ''}${t.validUntil} ${exp.toLocaleString(dateLocale)}${expired ? ` • ${t.expired}` : ''}`
            : meta,
          icon: Clock,
        });
      } else if (r.status === 'waitlist') {
        items.push({
          id: `rsvp:${r.id}:waitlist`,
          createdAt,
          category: 'events',
          title: t.titleWaitlist,
          body: `${eventTitle}`,
          meta,
          icon: Calendar,
        });
      } else if (r.status === 'confirmed') {
        items.push({
          id: `rsvp:${r.id}:confirmed`,
          createdAt,
          category: 'events',
          title: t.titleRegistrationConfirmed,
          body: `${eventTitle}`,
          meta,
          icon: Calendar,
        });
      }
    }

    const app = data?.application;
    if (app?.status) {
      items.push({
        id: `app:${app.id}:${app.status}`,
        createdAt: app.created_at || new Date().toISOString(),
        category: 'admin',
        title: t.titleApplicationStatus,
        body: `${applicationStatusLabel(app.status)}`,
        icon: FileCheck,
      });
    }

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  })();

  const filtered = notifications.filter((n) => prefs.categories[n.category] !== false);

  const unreadCount = filtered.filter((n) => !readIds[n.id]).length;

  const markAllRead = () => {
    const next = { ...readIds };
    for (const n of filtered) next[n.id] = true;
    setReadIds(next);
    writeReadIds(next);
  };

  const toggleCategory = (key: string) => {
    const next: Prefs = {
      ...prefs,
      categories: { ...prefs.categories, [key]: !prefs.categories[key] },
    };
    setPrefs(next);
    writePrefs(next);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <Bell className="text-green-600" />
              {t.headerTitle}
            </h2>
            <p className="text-stone-500 font-medium mt-2">{t.headerSubtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
              {t.unread}: {unreadCount}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              {t.markAllRead}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <h3 className="text-lg font-black text-stone-900 mb-6 flex items-center gap-3">
          <Settings className="text-green-600" />
          {t.preferences}
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { key: 'events', label: t.categoryEvents },
            { key: 'payments', label: t.categoryPayments },
            { key: 'admin', label: t.categoryAdmin },
            { key: 'community', label: t.categoryCommunity },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleCategory(c.key)}
              className={`p-4 rounded-2xl border text-left transition ${
                prefs.categories[c.key] !== false ? 'bg-green-50 border-green-200' : 'bg-stone-50 border-stone-100'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{c.label}</div>
              <div className="font-black text-stone-900">{prefs.categories[c.key] !== false ? t.on : t.off}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[3rem] border border-stone-100 shadow-sm">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            {t.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.slice(0, 80).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  const next = { ...readIds, [n.id]: true };
                  setReadIds(next);
                  writeReadIds(next);
                }}
                className={`w-full text-left p-5 rounded-[2rem] border transition ${
                  readIds[n.id] ? 'bg-stone-50 border-stone-100' : 'bg-white border-green-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                    readIds[n.id] ? 'bg-white border-stone-100 text-stone-400' : 'bg-green-50 border-green-200 text-green-700'
                  }`}>
                    <n.icon size={18} />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                      <div className="font-black text-stone-900">{n.title}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                        {new Date(n.createdAt).toLocaleString(dateLocale)}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-stone-700 mt-1">{n.body}</div>
                    {n.meta && (
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 mt-2">{n.meta}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
