'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MessageSquare, Send, Paperclip } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';

export default function TrustBoxTicketClient() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const sp = useSearchParams();
  const tokenFromQuery = String(sp.get('token') || '').trim();
  const codeFromQuery = String(sp.get('code') || '').trim();
  const { showToast } = useToast();

  const [token, setToken] = useState(tokenFromQuery);
  const [accessCode, setAccessCode] = useState(codeFromQuery);
  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [downloading, setDownloading] = useState<string>('');

  const labels = useMemo(() => {
    return lang === 'en'
      ? { title: 'Trust Box thread', send: 'Send', placeholder: 'Write a message…', code: 'Access code', open: 'Open thread' }
      : { title: 'Vlákno schránky důvěry', send: 'Odeslat', placeholder: 'Napište zprávu…', code: 'Přístupový kód', open: 'Otevřít vlákno' };
  }, [lang]);

  const triageLabels = useMemo(() => {
    const status = (v: any) => {
      const s = String(v || '').trim();
      if (lang === 'en') {
        if (s === 'new') return 'New';
        if (s === 'in_review') return 'In review';
        if (s === 'waiting_for_info') return 'Waiting for info';
        if (s === 'resolved') return 'Resolved';
        if (s === 'archived') return 'Archived';
        return s || '—';
      }
      if (s === 'new') return 'Nové';
      if (s === 'in_review') return 'V řešení';
      if (s === 'waiting_for_info') return 'Čeká na doplnění';
      if (s === 'resolved') return 'Vyřešeno';
      if (s === 'archived') return 'Archivováno';
      return s || '—';
    };
    const priority = (v: any) => {
      const s = String(v || '').trim();
      if (lang === 'en') {
        if (s === 'normal') return 'Normal';
        if (s === 'urgent') return 'Urgent';
        return s || '—';
      }
      if (s === 'normal') return 'Normální';
      if (s === 'urgent') return 'Urgentní';
      return s || '—';
    };
    const category = (v: any) => {
      const s = String(v || '').trim();
      if (!s) return '—';
      if (lang === 'en') {
        if (s === 'safety') return 'Safety';
        if (s === 'harassment') return 'Harassment';
        if (s === 'ethics') return 'Ethics';
        if (s === 'other') return 'Other';
        return s;
      }
      if (s === 'safety') return 'Bezpečnost';
      if (s === 'harassment') return 'Obtěžování';
      if (s === 'ethics') return 'Etika';
      if (s === 'other') return 'Jiné';
      return s;
    };
    return { status, priority, category };
  }, [lang]);

  useEffect(() => {
    setToken(tokenFromQuery);
  }, [tokenFromQuery]);

  useEffect(() => {
    if (codeFromQuery) setAccessCode(codeFromQuery);
  }, [codeFromQuery]);

  const exchangeCode = React.useCallback(async () => {
    if (!accessCode.trim()) return;
    setExchanging(true);
    try {
      const res = await fetch('/api/trustbox/access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessCode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      const t = String(json?.token || '').trim();
      if (!t) throw new Error('Error');
      setToken(t);
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
    } finally {
      setExchanging(false);
    }
  }, [accessCode, showToast]);

  const load = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/trustbox/thread?token=${encodeURIComponent(token)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      setThread(json.thread);
      setMessages(json.messages || []);
      setAttachments(Array.isArray(json.attachments) ? json.attachments : []);
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);
  
  useEffect(() => {
    if (token) return;
    if (!accessCode.trim()) return;
    exchangeCode();
  }, [token, accessCode, exchangeCode]);

  const downloadAttachment = React.useCallback(
    async (attachmentId: string) => {
      if (!token) return;
      setDownloading(attachmentId);
      try {
        const res = await fetch('/api/trustbox/attachments/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, attachmentId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Error');
        const url = String(json?.url || '');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e: any) {
        showToast(e?.message || 'Error', 'error');
      } finally {
        setDownloading('');
      }
    },
    [showToast, token],
  );

  const attByMessage = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of attachments) {
      const mid = String(a?.message_id || '').trim();
      if (!mid) continue;
      const list = m.get(mid) || [];
      list.push(a);
      m.set(mid, list);
    }
    return m;
  }, [attachments]);

  const onSend = async () => {
    if (!token || !text.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/trustbox/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, message: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      setText('');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tighter mb-2">{labels.title}</h1>
          {thread?.subject ? <div className="text-stone-500 font-bold">{thread.subject}</div> : null}
          {thread?.status || thread?.category || thread?.priority ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {thread?.status ? (
                <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-800 text-[10px] font-black uppercase tracking-widest border border-stone-200">
                  {lang === 'en' ? 'Status' : 'Stav'}: {triageLabels.status(thread.status)}
                </span>
              ) : null}
              {thread?.category ? (
                <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-800 text-[10px] font-black uppercase tracking-widest border border-stone-200">
                  {lang === 'en' ? 'Category' : 'Kategorie'}: {triageLabels.category(thread.category)}
                </span>
              ) : null}
              {thread?.priority ? (
                <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-800 text-[10px] font-black uppercase tracking-widest border border-stone-200">
                  {lang === 'en' ? 'Priority' : 'Priorita'}: {triageLabels.priority(thread.priority)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-stone-100">
          {!token ? (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{labels.code}</label>
                <input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
              <button
                disabled={exchanging || !accessCode.trim()}
                onClick={exchangeCode}
                className="w-full bg-green-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-xl shadow-green-900/20 flex items-center justify-center gap-3"
              >
                {exchanging ? <InlinePulse className="bg-white/80" size={14} /> : <Send size={20} />}
                {labels.open}
              </button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12">
              <InlinePulse className="bg-stone-400/70" size={14} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                      {String(m.author_type || '').toLowerCase() === 'reporter'
                        ? (lang === 'en' ? 'You' : 'Vy')
                        : `${String(m.author_type || '')}${m.author_name ? ` (${String(m.author_name)})` : ''}`}
                    </div>
                    <div className="font-bold text-stone-800 whitespace-pre-wrap">{m.body}</div>
                    {(attByMessage.get(String(m.id)) || []).length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(attByMessage.get(String(m.id)) || []).map((a: any) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => downloadAttachment(String(a.id))}
                            disabled={downloading === String(a.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-700 hover:bg-stone-100 transition disabled:opacity-50"
                            title={String(a.original_name || '')}
                          >
                            {downloading === String(a.id) ? <InlinePulse className="bg-stone-400/70" size={12} /> : <Paperclip size={14} />}
                            {String(a.original_name || 'Příloha')}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition resize-none" placeholder={labels.placeholder} />
                <button
                  disabled={sending || !text.trim()}
                  onClick={onSend}
                  className="w-full bg-green-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-xl shadow-green-900/20 flex items-center justify-center gap-3"
                >
                  {sending ? <InlinePulse className="bg-white/80" size={14} /> : <Send size={20} />}
                  {labels.send}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
