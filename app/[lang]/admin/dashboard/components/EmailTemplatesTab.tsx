'use client';

import React, { useMemo, useState } from 'react';
import { Mail, Send, Eye } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { listEmailTemplates, renderEmailTemplate, type EmailTemplateKey } from '@/lib/email/templates';
import { supabase } from '@/lib/supabase';

export default function EmailTemplatesTab() {
  const { showToast } = useToast();
  const templates = useMemo(() => listEmailTemplates(), []);
  const [templateKey, setTemplateKey] = useState<EmailTemplateKey>(templates[0]?.key || 'ticket');
  const [to, setTo] = useState('');
  const [variablesJson, setVariablesJson] = useState(
    JSON.stringify(
      {
        email: 'test@example.com',
        name: 'Test',
        eventTitle: 'Ukázková akce',
        attendees: [{ name: 'Test' }],
        paymentMethod: 'hotove',
        qrToken: 'ABCDEFGH',
        status: 'confirmed',
        bankAccount: 'CZ1234567890',
        firstName: 'Test',
        password: 'Secret123',
        rsvpId: 'rsvp_123',
        eventId: 'event_123',
        buyerType: 'person',
        buyerName: 'Jan Novák',
        buyerAddress: 'Ulice 1\nPraha',
        ico: '',
        dic: '',
        note: '',
      },
      null,
      2
    )
  );
  const [previewOpen, setPreviewOpen] = useState(true);
  const [sending, setSending] = useState(false);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(variablesJson) };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || 'Invalid JSON' };
    }
  }, [variablesJson]);

  const preview = useMemo(() => {
    if (!parsed.ok) return null;
    try {
      return renderEmailTemplate(templateKey as any, parsed.value);
    } catch (e: any) {
      return { subject: 'Chyba', html: `<pre>${String(e?.message || e)}</pre>` };
    }
  }, [parsed, templateKey]);

  const sendTest = async () => {
    if (!to.trim()) {
      showToast('Zadejte e-mail', 'error');
      return;
    }
    if (!parsed.ok) {
      showToast('Opravte JSON proměnných', 'error');
      return;
    }
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: to.trim(),
          templateKey,
          variables: parsed.value,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Send failed');
      }
      showToast('Test e-mail odeslán', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <Mail className="text-green-600" />
              E-mail šablony
            </h2>
            <p className="text-stone-500 font-medium">Náhled šablon a odeslání testovacího e-mailu.</p>
          </div>
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            <Eye size={16} />
            {previewOpen ? 'Skrýt náhled' : 'Zobrazit náhled'}
          </button>
        </div>

        <div className="mt-8 grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Šablona</div>
              <select
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value as EmailTemplateKey)}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
              >
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-stone-300">
                Proměnné: {templates.find((t) => t.key === templateKey)?.variables?.join(', ')}
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Test e-mail</div>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="test@pupen.org"
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
              />
              <button
                type="button"
                onClick={sendTest}
                disabled={sending}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
              >
                {sending ? <InlinePulse className="bg-white/80" size={14} /> : <Send size={16} />}
                Odeslat test
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Proměnné (JSON)</div>
              <textarea
                value={variablesJson}
                onChange={(e) => setVariablesJson(e.target.value)}
                rows={14}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-mono text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition resize-none"
              />
              {!parsed.ok && (
                <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-600">{parsed.error}</div>
              )}
            </div>

            {previewOpen && preview && (
              <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-stone-100 bg-stone-50/50">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Předmět</div>
                  <div className="font-bold text-stone-900">{preview.subject}</div>
                </div>
                <iframe title="Email preview" className="w-full h-[520px]" srcDoc={preview.html} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
