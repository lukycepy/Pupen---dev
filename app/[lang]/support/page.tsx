'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import InlinePulse from '@/app/components/InlinePulse';
import { getDictionary } from '@/lib/get-dictionary';
import { LifeBuoy, ArrowLeft } from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import Panel from '@/app/components/ui/Panel';

export default function SupportPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  const [dict, setDict] = useState<any>(null);
  const [pageHtml, setPageHtml] = useState<string>('');
  const [pageTitle, setPageTitle] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getDictionary(lang).then((d) => setDict(d));
  }, [lang]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = new URL('/api/site-page', window.location.origin);
        url.searchParams.set('slug', 'support');
        url.searchParams.set('lang', lang);
        const res = await fetch(url.toString());
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const page = json?.page || null;
        if (mounted) {
          setPageHtml(String(page?.content_html || ''));
          setPageTitle(String(page?.title || ''));
        }
      } catch {
        if (mounted) {
          setPageHtml('');
          setPageTitle('');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  const common = dict?.common || {};
  const t = dict?.supportPage || {};

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) return;
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || t.defaultName || 'Support request',
          email,
          hp: '',
          subject: t.subject || 'Support',
          message,
        }),
      });
      if (!res.ok) throw new Error('Error');
      setSent(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setSent(false);
      alert(t.sendError || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-3xl mx-auto px-6">
        <PageHeader
          icon={LifeBuoy}
          badge={t.badge || 'Support'}
          title={t.title || 'Support'}
          subtitle={t.subtitle || ''}
          actions={
            <Link
              href={`/${lang}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              <ArrowLeft size={16} />
              {common.back || 'Back'}
            </Link>
          }
        />

        <Panel className="mt-8" padded>
          {pageHtml ? (
            <div className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm mb-6">
              {pageTitle ? <div className="text-xl font-black text-stone-900 mb-4">{pageTitle}</div> : null}
              <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
            </div>
          ) : null}
          {sent && (
            <div className="bg-green-50 text-green-700 p-4 rounded-2xl font-bold text-sm">
              {t.sent || 'Message sent.'}
            </div>
          )}

          <form onSubmit={submit} className={sent ? 'mt-6 space-y-4' : 'space-y-4'}>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">
                  {t.nameOptional || 'Name'}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">{common.email || 'E-mail'}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">
                {common.message || 'Message'}
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-medium text-stone-700 focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? <InlinePulse className="bg-white/80" size={16} /> : null}
              {common.send || 'Send'}
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
