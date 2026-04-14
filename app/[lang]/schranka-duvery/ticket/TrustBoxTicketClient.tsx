'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MessageSquare, Send } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';

export default function TrustBoxTicketClient() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const sp = useSearchParams();
  const token = String(sp.get('token') || '').trim();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const labels = useMemo(() => {
    return lang === 'en'
      ? { title: 'Trust Box thread', send: 'Send', placeholder: 'Write a message…' }
      : { title: 'Vlákno schránky důvěry', send: 'Odeslat', placeholder: 'Napište zprávu…' };
  }, [lang]);

  const load = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/trustbox/thread?token=${encodeURIComponent(token)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      setThread(json.thread);
      setMessages(json.messages || []);
    } catch (e: any) {
      showToast(e?.message || 'Error', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

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
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-stone-100">
          {loading ? (
            <div className="flex justify-center py-12">
              <InlinePulse className="bg-stone-400/70" size={14} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">{m.author_type}</div>
                    <div className="font-bold text-stone-800 whitespace-pre-wrap">{m.body}</div>
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

