'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import ConfirmModal from '@/app/components/ConfirmModal';
import { useToast } from '@/app/context/ToastContext';
import { Mail, Plus, Search, Send, X, AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import Portal from '@/app/components/ui/Portal';

type Thread = {
  threadId: string;
  peerEmail: string;
  peerId?: string;
  peerLabel?: string;
  lastAt: string;
  lastMessage: string;
  unreadCount?: number;
  isBlocked?: boolean;
};

export default function MemberMessagesTab({ lang }: { lang: string }) {
  const { showToast } = useToast();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberQ, setMemberQ] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const threadIdFor = (a: string, b: string) => [a, b].sort().join(':');

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');
    return token;
  }, [lang]);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/dm/threads', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setThreads(json.threads || []);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoadingThreads(false);
    }
  }, [getToken, showToast]);

  const loadThread = async (thread: Thread) => {
    setLoadingThread(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/dm/thread?threadId=${encodeURIComponent(thread.threadId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setMessages(json.messages || []);
      setSelected(thread);
      
      // Update unread count locally if it was selected
      setThreads((prev) => prev.map(t => t.threadId === thread.threadId ? { ...t, unreadCount: 0 } : t));

      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoadingThread(false);
    }
  };

  const toggleBlock = async () => {
    if (!selected) return;
    try {
      const token = await getToken();
      const action = selected.isBlocked ? 'unblock' : 'block';
      const res = await fetch('/api/dm/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ threadId: selected.threadId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Action failed');
      
      setSelected({ ...selected, isBlocked: json.isBlocked });
      setThreads((prev) => prev.map(t => t.threadId === selected.threadId ? { ...t, isBlocked: json.isBlocked } : t));
      showToast(lang === 'en' ? 'Success' : 'Úspěšně změněno', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  const reportMessage = async (messageId: string) => {
    try {
      const token = await getToken();
      const res = await fetch('/api/dm/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId, reason: 'Nahlášeno uživatelem z DM' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Report failed');
      showToast(lang === 'en' ? 'Message reported' : 'Zpráva byla nahlášena', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  const send = async () => {
    if (!selected) return;
    if (!selected.peerId) {
      showToast(lang === 'en' ? 'Missing recipient' : 'Chybí příjemce', 'error');
      return;
    }
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/dm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          toId: selected.peerId,
          toEmail: selected.peerEmail,
          toLabel: selected.peerLabel || selected.peerEmail,
          message: msg,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Send failed');
      setText('');
      await loadThread(selected);
      await loadThreads();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSending(false);
    }
  };

  const loadMembers = async () => {
    setMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, is_member')
        .eq('is_member', true)
        .order('last_name', { ascending: true })
        .limit(400);
      if (error) throw error;
      setMembers((data || []).filter((m: any) => !!m.email));
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (u?.id && u?.email) setMe({ id: u.id, email: u.email });
    })();
    loadThreads();
  }, [loadThreads]);

  const filteredThreads = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((t) => `${t.peerLabel || ''} ${t.peerEmail || ''} ${t.lastMessage || ''}`.toLowerCase().includes(query));
  }, [q, threads]);

  const filteredMembers = useMemo(() => {
    const query = memberQ.trim().toLowerCase();
    if (!query) return members.slice(0, 50);
    return members
      .filter((m: any) => `${m.first_name || ''} ${m.last_name || ''} ${m.email || ''}`.toLowerCase().includes(query))
      .slice(0, 50);
  }, [memberQ, members]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ConfirmModal
        isOpen={!!reportingId}
        onClose={() => setReportingId(null)}
        onConfirm={() => {
          if (reportingId) reportMessage(reportingId);
        }}
        title={lang === 'en' ? 'Report message?' : 'Nahlásit zprávu?'}
        message={lang === 'en' ? 'This will send a report to moderators.' : 'Tímto odešlete hlášení moderátorům.'}
        confirmLabel={lang === 'en' ? 'Report' : 'Nahlásit'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Zrušit'}
        variant="warning"
      />
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <Mail className="text-green-600" />
              {lang === 'en' ? 'Messages' : 'Zprávy'}
            </h2>
            <p className="text-stone-500 font-medium mt-2">
              {lang === 'en' ? 'Simple internal messaging between members.' : 'Jednoduché interní zprávy mezi členy.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setNewOpen(true);
                if (members.length === 0) await loadMembers();
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
            >
              <Plus size={16} />
              {lang === 'en' ? 'New' : 'Nová'}
            </button>
            <button
              type="button"
              onClick={loadThreads}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              {lang === 'en' ? 'Refresh' : 'Obnovit'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-[3rem] border border-stone-100 shadow-sm">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={lang === 'en' ? 'Search…' : 'Hledat…'}
                className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              />
            </div>
            <div className="mt-6 space-y-2">
              {loadingThreads ? (
                <div className="py-10 flex items-center justify-center">
                  <InlinePulse className="bg-stone-200" size={18} />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                  {lang === 'en' ? 'No threads.' : 'Zatím žádné konverzace.'}
                </div>
              ) : (
                filteredThreads.slice(0, 60).map((t) => (
                  <button
                    key={t.threadId}
                    type="button"
                    onClick={() => loadThread(t)}
                    className={`w-full text-left p-4 rounded-[2rem] border transition relative ${
                      selected?.threadId === t.threadId ? 'bg-green-50 border-green-200' : 'bg-stone-50 border-stone-100 hover:bg-stone-100'
                    }`}
                  >
                    {t.unreadCount ? (
                      <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {t.unreadCount}
                      </div>
                    ) : null}
                    <div className="font-black text-stone-900 pr-8 truncate">{t.peerLabel || t.peerEmail}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 truncate mt-1">
                      {t.peerEmail}
                    </div>
                    <div className="text-sm font-medium text-stone-600 mt-2 line-clamp-2">
                      {t.lastMessage || '—'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-[3rem] border border-stone-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <div className="font-black text-stone-900 truncate">
                  {selected ? selected.peerLabel || selected.peerEmail : lang === 'en' ? 'Select a thread' : 'Vyberte konverzaci'}
                </div>
                {selected && <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">{selected.peerEmail}</div>}
              </div>
              {selected && (
                <button
                  type="button"
                  onClick={toggleBlock}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border transition ${
                    selected.isBlocked
                      ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                      : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {selected.isBlocked ? (
                    <>
                      <ShieldCheck size={14} />
                      {lang === 'en' ? 'Unblock' : 'Odblokovat'}
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={14} />
                      {lang === 'en' ? 'Block' : 'Blokovat'}
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="p-6 h-[520px] overflow-y-auto bg-stone-50/30">
              {loadingThread ? (
                <div className="py-16 flex items-center justify-center">
                  <InlinePulse className="bg-stone-200" size={18} />
                </div>
              ) : !selected ? (
                <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                  {lang === 'en' ? 'Choose a conversation.' : 'Zvolte konverzaci.'}
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                  {lang === 'en' ? 'No messages yet.' : 'Zatím žádné zprávy.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m: any) => {
                    const isMine = me?.email ? m.fromEmail === me.email : m.fromEmail !== selected.peerEmail;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`relative max-w-[75%] rounded-[1.5rem] px-5 py-4 border ${
                          isMine ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-800 border-stone-200'
                        }`}>
                          <div className="text-sm font-bold whitespace-pre-line">{m.message}</div>
                          <div className={`mt-2 flex items-center justify-between gap-4 text-[10px] font-black uppercase tracking-widest ${
                            isMine ? 'text-white/70' : 'text-stone-300'
                          }`}>
                            <span>{m.createdAt ? new Date(m.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ') : ''}</span>
                            {!isMine && (
                              <button
                                type="button"
                                onClick={() => setReportingId(String(m.id))}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 flex items-center gap-1"
                                title={lang === 'en' ? 'Report message' : 'Nahlásit zprávu'}
                              >
                                <AlertTriangle size={12} />
                                <span className="sr-only">{lang === 'en' ? 'Report' : 'Nahlásit'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-stone-100">
              <div className="flex items-end gap-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  disabled={!selected || sending || selected.isBlocked}
                  placeholder={
                    !selected 
                      ? (lang === 'en' ? 'Select a thread' : 'Vyberte konverzaci')
                      : selected.isBlocked 
                        ? (lang === 'en' ? 'Thread is blocked' : 'Konverzace je blokována')
                        : (lang === 'en' ? 'Write a message…' : 'Napište zprávu…')
                  }
                  className="flex-1 bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!selected || sending || !text.trim() || selected.isBlocked}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {sending ? <InlinePulse className="bg-white/80" size={14} /> : <Send size={16} />}
                  {lang === 'en' ? 'Send' : 'Odeslat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {newOpen && (
        <Portal>
          <div className="fixed inset-0 z-[10003] flex items-center justify-center p-6">
            <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNewOpen(false)} aria-label="Zavřít" />
            <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="font-black text-stone-900">{lang === 'en' ? 'Start new message' : 'Nová zpráva'}</div>
                <button type="button" onClick={() => setNewOpen(false)} className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400" aria-label="Zavřít">
                  <X size={18} />
                </button>
              </div>
              <div className="p-8 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                <input
                  value={memberQ}
                  onChange={(e) => setMemberQ(e.target.value)}
                  placeholder={lang === 'en' ? 'Search member…' : 'Hledat člena…'}
                  className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
              {membersLoading ? (
                <div className="py-10 flex items-center justify-center">
                  <InlinePulse className="bg-stone-200" size={18} />
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto space-y-2">
                  {filteredMembers.map((m: any) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if (!me?.id) {
                          showToast(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen', 'error');
                          return;
                        }
                        const label = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
                        const t: Thread = {
                          threadId: threadIdFor(String(me.id), String(m.id)),
                          peerEmail: String(m.email),
                          peerId: String(m.id),
                          peerLabel: label,
                          lastAt: new Date().toISOString(),
                          lastMessage: '',
                        };
                        setNewOpen(false);
                        loadThread(t);
                      }}
                      className="w-full text-left p-4 rounded-[2rem] border border-stone-100 bg-stone-50 hover:bg-stone-100 transition"
                    >
                      <div className="font-black text-stone-900">{`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 mt-1">{m.email}</div>
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
