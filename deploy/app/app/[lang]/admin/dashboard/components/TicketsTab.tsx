'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Search, CheckCircle, Loader2, User, Calendar, Send, Camera, X, RefreshCcw, Download } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import Skeleton from '@/app/[lang]/components/Skeleton';
import InlinePulse from '@/app/components/InlinePulse';
import ConfirmModal from '@/app/components/ConfirmModal';
import Dialog from '@/app/components/ui/Dialog';

export default function TicketsTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [feedbackConfirmOpen, setFeedbackConfirmOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanBusyRef = useRef(false);

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['admin_events_tickets'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('id, title, date, location').order('date', { ascending: false });
      return data || [];
    }
  });

  const { data: attendees = [], isLoading: attendeesLoading } = useQuery({
    queryKey: ['attendees', activeEvent],
    enabled: !!activeEvent,
    queryFn: async () => {
      const { data } = await supabase
        .from('rsvp')
        .select('*')
        .eq('event_id', activeEvent)
        .order('name');
      return data || [];
    }
  });

  const checkedInCount = useMemo(() => attendees.filter((a: any) => a.checked_in).length, [attendees]);
  const activeEventObj = useMemo(() => (events || []).find((e: any) => String(e.id) === String(activeEvent)), [activeEvent, events]);
  const eventIsPast = useMemo(() => {
    if (!activeEventObj?.date) return false;
    const dt = new Date(activeEventObj.date);
    if (Number.isNaN(dt.getTime())) return false;
    return dt.getTime() < Date.now();
  }, [activeEventObj?.date]);

  const { data: noShowLogs = [] } = useQuery({
    queryKey: ['no_show_logs', activeEvent],
    enabled: !!activeEvent,
    queryFn: async () => {
      const res = await supabase
        .from('admin_logs')
        .select('id, created_at, action, target_id, details')
        .eq('target_id', String(activeEvent))
        .in('action', ['NO_SHOW', 'NO_SHOW_UNDO'])
        .order('created_at', { ascending: false })
        .limit(1000);
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  const noShowByRsvpId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of noShowLogs as any[]) {
      const rsvpId = row.details?.rsvpId ? String(row.details.rsvpId) : '';
      if (!rsvpId || map.has(rsvpId)) continue;
      map.set(rsvpId, row.action === 'NO_SHOW');
    }
    return map;
  }, [noShowLogs]);

  const noShowCount = useMemo(() => attendees.filter((a: any) => noShowByRsvpId.get(String(a.id))).length, [attendees, noShowByRsvpId]);
  const pendingCount = useMemo(
    () => attendees.filter((a: any) => !a.checked_in && !noShowByRsvpId.get(String(a.id)) && a.status !== 'cancelled').length,
    [attendees, noShowByRsvpId]
  );

  const checkInMutation = useMutation({
    mutationFn: async ({ id, checked_in }: { id: string, checked_in: boolean }) => {
      if (!activeEvent) throw new Error('Missing event');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/tickets/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: activeEvent, rsvpId: id, checkedIn: checked_in, source: 'list' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendees', activeEvent] });
      showToast('Status aktualizován', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const noShowMutation = useMutation({
    mutationFn: async ({ attendee, next }: { attendee: any; next: boolean }) => {
      if (!activeEvent) throw new Error('Missing event');
      if (!eventIsPast) throw new Error('Akce ještě neskončila');
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email || 'admin';

      const payload = {
        rsvpId: String(attendee.id),
        email: attendee.email,
        name: attendee.name,
        status: attendee.status,
        createdAt: new Date().toISOString(),
      };

      const res = await supabase.from('admin_logs').insert([
        {
          admin_email: email,
          admin_name: 'NoShow',
          action: next ? 'NO_SHOW' : 'NO_SHOW_UNDO',
          target_id: String(activeEvent),
          details: payload,
        },
      ]);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['no_show_logs', activeEvent] });
      showToast('Uloženo', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const downloadCsv = useCallback(() => {
    if (!activeEvent) return;
    const rows = attendees.map((a: any) => {
      const count = Array.isArray(a.attendees) ? a.attendees.length : 1;
      const noShow = !!noShowByRsvpId.get(String(a.id));
      return {
        rsvp_id: String(a.id),
        event_id: String(a.event_id || activeEvent),
        name: String(a.name || ''),
        email: String(a.email || ''),
        status: String(a.status || ''),
        attendees_count: String(count),
        checked_in: a.checked_in ? '1' : '0',
        no_show: noShow ? '1' : '0',
        created_at: String(a.created_at || ''),
      };
    });

    const header = Object.keys(rows[0] || { rsvp_id: '' });
    const esc = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [header.join(','), ...rows.map((r: any) => header.map((h) => esc(r[h])).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${activeEvent}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeEvent, attendees, noShowByRsvpId]);

  useEffect(() => {
    scanBusyRef.current = scanBusy;
  }, [scanBusy]);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
  }, []);

  const normalizeToken = useCallback((raw: string) => {
    const t = (raw || '').trim();
    if (!t) return '';
    if (t.startsWith('PUPEN-TICKET:')) return t.replace('PUPEN-TICKET:', '').trim();
    return t;
  }, []);

  const processToken = useCallback(async (rawToken: string) => {
    if (!activeEvent) return;
    const token = normalizeToken(rawToken);
    if (!token) return;
    setScanBusy(true);
    setScanMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const auth = data.session?.access_token;
      if (!auth) throw new Error('Unauthorized');
      const resp = await fetch('/api/admin/tickets/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ eventId: activeEvent, token, checkedIn: true, source: 'scan' }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg =
          json?.error === 'Not found'
            ? 'Kód nenalezen pro tuto akci'
            : json?.error === 'Cancelled'
              ? 'Registrace je zrušena'
              : json?.error === 'Expired'
                ? 'Rezervace expirovala'
                : 'Chyba při odbavení';
        setScanMessage(msg);
        showToast(msg, 'error');
        return;
      }

      if (json?.status === 'already_checked_in') {
        setScanMessage('Už odbaveno');
        showToast('Už odbaveno', 'info');
        return;
      }

      setScanMessage('Odbaveno');
      queryClient.invalidateQueries({ queryKey: ['attendees', activeEvent] });
    } catch (e: any) {
      setScanMessage('Chyba při odbavení');
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setScanBusy(false);
    }
  }, [activeEvent, normalizeToken, queryClient, showToast]);

  useEffect(() => {
    if (!scannerOpen) return;
    setManualToken('');
    setScanMessage(null);
    setScanBusy(false);

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

        const Detector = (window as any).BarcodeDetector;
        if (!Detector) return;
        const detector = new Detector({ formats: ['qr_code'] });

        let raf = 0;
        const tick = async () => {
          const v = videoRef.current;
          if (!v || v.readyState < 2 || scanBusyRef.current) {
            raf = window.requestAnimationFrame(tick);
            return;
          }
          try {
            const barcodes = await detector.detect(v);
            const first = barcodes?.[0]?.rawValue;
            if (first) {
              await processToken(first);
            }
          } catch {}
          raf = window.requestAnimationFrame(tick);
        };
        raf = window.requestAnimationFrame(tick);

        return () => window.cancelAnimationFrame(raf);
      } catch {
        setScanMessage('Kamera není dostupná. Použijte ruční zadání.');
      }
    };

    let cleanupRaf: null | (() => void) = null;
    start().then((c: any) => {
      cleanupRaf = typeof c === 'function' ? c : null;
    });

    return () => {
      cleanupRaf?.();
      stopStream();
    };
  }, [processToken, scannerOpen, stopStream]);

  const filteredAttendees = attendees.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.qr_code && a.qr_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sendFeedbackMutation = useMutation({
    mutationFn: async (eventId: string) => {
      // Simulace odeslání e-mailů všem přihlášeným
      const { data: event } = await supabase.from('events').select('title').eq('id', eventId).single();
      const { data: rsvps } = await supabase.from('rsvp').select('email').eq('event_id', eventId).eq('status', 'confirmed');
      
      if (!rsvps || rsvps.length === 0) throw new Error('Žádní účastníci pro odeslání feedbacku');
      
      // V reálné app by se zde volalo API (např. Resend / SendGrid)
      console.log(`Sending feedback emails for ${event?.title} to ${rsvps.length} users`);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulace prodlevy
    },
    onSuccess: () => {
      showToast('E-maily s žádostí o feedback byly odeslány!', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  return (
    <div className="space-y-8">
      <ConfirmModal
        isOpen={feedbackConfirmOpen}
        onClose={() => setFeedbackConfirmOpen(false)}
        onConfirm={() => {
          if (activeEvent) sendFeedbackMutation.mutate(activeEvent);
        }}
        title="Požádat o feedback?"
        message="Odeslat všem potvrzeným účastníkům e-mail s žádostí o zpětnou vazbu?"
        confirmLabel="Odeslat"
        cancelLabel="Zrušit"
        variant="warning"
      />
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3 mb-1">
            <QrCode className="text-green-600" />
            Check-in & Vstupenky
          </h2>
          <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Správa docházky a kontrola QR kódů</p>
        </div>

        <div className="flex-grow max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
          <input 
            type="text" 
            placeholder="Hledat podle jména, e-mailu nebo kódu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-stone-50 border-none rounded-2xl font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition shadow-inner"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* EVENT LIST */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 px-4">Vyberte akci</h3>
          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event: any) => (
                <button
                  key={event.id}
                  onClick={() => setActiveEvent(event.id)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${activeEvent === event.id ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-white border-stone-100 text-stone-600 hover:border-green-200'}`}
                >
                  <p className="font-bold text-sm truncate">{event.title}</p>
                  <div className={`flex items-center gap-2 text-[10px] mt-1 font-black uppercase tracking-widest ${activeEvent === event.id ? 'text-white/60' : 'text-stone-300'}`}>
                    <Calendar size={10} /> {new Date(event.date).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ATTENDEE LIST */}
        <div className="lg:col-span-3">
          {!activeEvent ? (
            <div className="bg-white rounded-[2.5rem] border border-dashed p-20 flex flex-col items-center justify-center text-center">
              <QrCode size={64} className="text-stone-100 mb-6" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-sm">Vyberte akci ze seznamu pro zobrazení účastníků</p>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-stone-50/50 flex items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="font-bold text-stone-800">Seznam účastníků ({filteredAttendees.length})</h3>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Po skončení akce můžete účastníky požádat o feedback</p>
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={downloadCsv}
                    disabled={!attendees || attendees.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-stone-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-50 transition border border-stone-200 disabled:opacity-50"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-stone-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-50 transition border border-stone-200"
                  >
                    <Camera size={14} />
                    Skenovat QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackConfirmOpen(true)}
                    disabled={sendFeedbackMutation.isPending || attendees.filter(a => a.checked_in).length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition disabled:opacity-50"
                  >
                    {sendFeedbackMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                    Požádat o feedback
                  </button>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600">
                    <CheckCircle size={14} /> Přítomno: {checkedInCount}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
                    <RefreshCcw size={14} /> No-show: {noShowCount}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-500">
                    <User size={14} /> Neodbaveno: {pendingCount}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                    <User size={14} /> Celkem: {attendees.length}
                  </div>
                </div>
              </div>

              {attendeesLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32 rounded-lg" />
                          <Skeleton className="h-3 w-24 rounded-lg" />
                        </div>
                      </div>
                      <Skeleton className="h-10 w-24 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-stone-50">
                  {filteredAttendees.length === 0 ? (
                    <div className="p-20 text-center text-stone-300 font-bold uppercase tracking-widest text-xs">Žádní účastníci nenalezeni</div>
                  ) : (
                    filteredAttendees.map((attendee: any) => (
                      <div
                        key={attendee.id}
                        className={`flex items-center justify-between p-4 transition-colors ${
                          attendee.checked_in ? 'bg-green-50/30' : noShowByRsvpId.get(String(attendee.id)) ? 'bg-amber-50/40' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs uppercase ${attendee.checked_in ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-400'}`}>
                            {attendee.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-stone-900 text-sm">{attendee.name}</p>
                            <p className="text-[10px] text-stone-400 font-medium">{attendee.email}</p>
                            {noShowByRsvpId.get(String(attendee.id)) && (
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mt-1">no-show</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {attendee.qr_code && (
                            <code className="text-[10px] bg-stone-100 px-2 py-1 rounded font-mono text-stone-500 uppercase tracking-tighter">
                              {attendee.qr_code}
                            </code>
                          )}
                          <button
                            onClick={() => checkInMutation.mutate({ id: attendee.id, checked_in: !attendee.checked_in })}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${attendee.checked_in ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-stone-100 text-stone-400 hover:bg-green-600 hover:text-white shadow-sm'}`}
                          >
                            {attendee.checked_in ? (
                              <><CheckCircle size={14} /> Odbaveno</>
                            ) : (
                              <><User size={14} /> Odbavit</>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              noShowMutation.mutate({
                                attendee,
                                next: !noShowByRsvpId.get(String(attendee.id)),
                              })
                            }
                            disabled={noShowMutation.isPending || attendee.status === 'cancelled' || !eventIsPast}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              noShowByRsvpId.get(String(attendee.id))
                                ? 'bg-amber-100 text-amber-700 hover:bg-stone-100 hover:text-stone-500'
                                : 'bg-stone-100 text-stone-500 hover:bg-amber-500 hover:text-white'
                            } disabled:opacity-50`}
                          >
                            <RefreshCcw size={14} />
                            {noShowByRsvpId.get(String(attendee.id)) ? 'Undo' : 'No-show'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {scannerOpen && (
        <Dialog
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          overlayClassName="fixed inset-0 z-[10002] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          panelClassName="relative w-full max-w-xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Check-in</div>
                <div className="font-black text-stone-900">Skenovat QR</div>
              </div>
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400"
                aria-label="Zavřít"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-stone-50 border border-stone-100 rounded-[2rem] overflow-hidden aspect-video flex items-center justify-center relative">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {scanBusy && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <InlinePulse className="bg-white/80" size={18} />
                  </div>
                )}
              </div>

              {scanMessage && (
                <div className="text-center text-[10px] font-black uppercase tracking-widest text-stone-500">
                  {scanMessage}
                </div>
              )}

              <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Ruční zadání</div>
                <div className="flex gap-3">
                  <input
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Token…"
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => processToken(manualToken)}
                    disabled={!manualToken.trim() || scanBusy}
                    className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                  >
                    Odbavit
                  </button>
                </div>
              </div>
            </div>
        </Dialog>
      )}
    </div>
  );
}
