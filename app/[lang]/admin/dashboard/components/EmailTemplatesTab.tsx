'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Send, Eye, Save, Trash2, RefreshCw } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { listEmailTemplates, type EmailTemplateKey } from '@/lib/email/templates';
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
        subject: 'Ukázkový newsletter',
        preheader: 'Krátký preheader pro náhled v inboxu',
        html: '<p style="margin:0 0 12px 0;">Ahoj! Tohle je ukázkový obsah newsletteru.</p><p style="margin:0;">Díky, že čteš Pupen.</p>',
        unsubLink: 'https://pupen.org/unsubscribe?email=test@example.com',
        preferencesLink: 'https://pupen.org/unsubscribe?email=test@example.com',
      },
      null,
      2
    )
  );
  const [previewOpen, setPreviewOpen] = useState(true);
  const [sending, setSending] = useState(false);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string; source?: string } | null>(null);
  const [sendDiag, setSendDiag] = useState<any>(null);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(variablesJson) };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || 'Invalid JSON' };
    }
  }, [variablesJson]);

  const currentOverride = useMemo(() => {
    const key = String(templateKey || '');
    return overrides.find((o: any) => String(o?.template_key || '') === key) || null;
  }, [overrides, templateKey]);

  const getToken = async () => {
    let { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData.session?.access_token || '';
    if (!token) {
      await supabase.auth.refreshSession();
      sessionData = (await supabase.auth.getSession()).data;
      token = sessionData.session?.access_token || '';
    }
    if (!token) throw new Error('Přihlášení vypršelo. Obnovte stránku nebo se přihlaste znovu.');
    return token;
  };

  const loadOverrides = async () => {
    setOverridesLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/email/templates', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'x-supabase-token': token },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Load failed');
      setOverrides(Array.isArray(j?.overrides) ? j.overrides : []);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setOverridesLoading(false);
    }
  };

  const refreshPreview = async (opts?: { forceDraft?: boolean }) => {
    if (!parsed.ok) return;
    setPreviewLoading(true);
    try {
      const token = await getToken();
      const useDraft = opts?.forceDraft === true || !!draftSubject.trim() || !!draftHtml.trim();
      const res = await fetch('/api/admin/email/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-supabase-token': token },
        body: JSON.stringify({
          templateKey,
          variables: parsed.value,
          draftSubject: useDraft ? draftSubject : null,
          draftHtml: useDraft ? draftHtml : null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Preview failed');
      setPreview({ subject: String(j.subject || ''), html: String(j.html || ''), source: j.source ? String(j.source) : undefined });
    } catch (e: any) {
      setPreview({ subject: 'Chyba', html: `<pre>${String(e?.message || e)}</pre>` });
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    loadOverrides();
  }, []);

  useEffect(() => {
    if (currentOverride) {
      setDraftSubject(String(currentOverride.subject || ''));
      setDraftHtml(String(currentOverride.html || ''));
      setDraftEnabled(currentOverride.is_enabled !== false);
    } else {
      setDraftSubject('');
      setDraftHtml('');
      setDraftEnabled(true);
    }
  }, [templateKey, currentOverride]);

  useEffect(() => {
    if (!previewOpen) return;
    if (!parsed.ok) return;
    const t = setTimeout(() => {
      refreshPreview();
    }, 350);
    return () => clearTimeout(t);
  }, [previewOpen, templateKey, variablesJson, draftSubject, draftHtml]);

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
      const token = await getToken();
      const res = await fetch('/api/admin/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-supabase-token': token },
        body: JSON.stringify({
          to: to.trim(),
          templateKey,
          variables: parsed.value,
        }),
      });
      const j = await res.json().catch(() => ({}));
      setSendDiag(j);
      if (!res.ok) {
        const tcpMsg =
          j?.tcp?.ok === false
            ? `TCP: ${String(j?.tcp?.error?.message || 'fail')} (${String(j?.tcp?.host || '')}:${String(j?.tcp?.port || '')})`
            : '';
        throw new Error([j?.error || 'Send failed', tcpMsg].filter(Boolean).join(' • '));
      }
      const tcpOk = j?.tcp?.ok === true;
      const verified = j?.verified === true;
      showToast(`Test e-mail odeslán${tcpOk ? ' • TCP OK' : ''}${verified ? ' • verify OK' : ''}`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSending(false);
    }
  };

  const saveOverride = async () => {
    if (!draftSubject.trim() || !draftHtml.trim()) {
      showToast('Vyplňte subject i HTML', 'error');
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-supabase-token': token },
        body: JSON.stringify({ templateKey, subject: draftSubject, html: draftHtml, isEnabled: draftEnabled }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Save failed');
      showToast('Uloženo', 'success');
      await loadOverrides();
      await refreshPreview({ forceDraft: false });
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = async () => {
    setDeleting(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/email/templates/${templateKey}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'x-supabase-token': token },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Delete failed');
      showToast('Resetováno na default', 'success');
      await loadOverrides();
      await refreshPreview({ forceDraft: false });
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setDeleting(false);
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
            <p className="text-stone-500 font-medium">Správa override šablon, náhled a odeslání testovacího e-mailu.</p>
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

            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Override</div>
                <button
                  type="button"
                  onClick={loadOverrides}
                  disabled={overridesLoading}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {overridesLoading ? <InlinePulse className="bg-stone-400/70" size={14} /> : <RefreshCw size={14} />}
                  Reload
                </button>
              </div>

              <label className="flex items-center gap-3 text-xs font-bold text-stone-600">
                <input
                  type="checkbox"
                  checked={draftEnabled}
                  onChange={(e) => setDraftEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                Aktivní
              </label>

              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Subject template</div>
                <input
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  placeholder="Např. Vstupenka: {{eventTitle}}"
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                />
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">HTML template</div>
                <textarea
                  value={draftHtml}
                  onChange={(e) => setDraftHtml(e.target.value)}
                  rows={10}
                  placeholder="<h1>{{eventTitle}}</h1>\n<div>{{{html}}}</div>"
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-mono text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition resize-none"
                />
                <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                  Tokeny: {'{{x}}'} escapuje, {'{{{x}}}'} neescapuje.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={saveOverride}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {saving ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />}
                  Uložit
                </button>
                <button
                  type="button"
                  onClick={deleteOverride}
                  disabled={deleting || !currentOverride}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {deleting ? <InlinePulse className="bg-stone-400/70" size={14} /> : <Trash2 size={16} />}
                  Reset
                </button>
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
              {sendDiag ? (
                <div className="mt-3 text-xs font-bold text-stone-600">
                  <div>
                    SMTP: {String(sendDiag?.debug?.host || '—')}:{String(sendDiag?.debug?.port || '—')}
                    {sendDiag?.tcp?.ok === true ? ` • TCP OK (${Number(sendDiag?.tcp?.ms || 0)} ms)` : sendDiag?.tcp ? ` • TCP FAIL` : ''}
                    {sendDiag?.tls?.ok === true ? ` • TLS OK (${Number(sendDiag?.tls?.ms || 0)} ms)` : sendDiag?.tls ? ` • TLS FAIL` : ''}
                  </div>
                  {sendDiag?.tcp?.ok === false ? (
                    <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
                      {String(sendDiag?.tcp?.error?.message || 'Connection failed')}
                    </div>
                  ) : null}
                  {sendDiag?.tls?.ok === false ? (
                    <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
                      {String(sendDiag?.tls?.error?.message || 'TLS failed')}
                    </div>
                  ) : null}
                  {sendDiag?.verifyError?.message ? (
                    <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-600">
                      {String(sendDiag.verifyError.message)}
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Předmět</div>
                      <div className="font-bold text-stone-900">{preview.subject}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {preview.source ? (
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">{String(preview.source)}</div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => refreshPreview()}
                        disabled={previewLoading || !parsed.ok}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                      >
                        {previewLoading ? <InlinePulse className="bg-stone-400/70" size={14} /> : <RefreshCw size={14} />}
                        Aktualizovat
                      </button>
                    </div>
                  </div>
                </div>
                <iframe title="Email preview" className="w-full h-[520px]" srcDoc={preview.html} sandbox="" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
