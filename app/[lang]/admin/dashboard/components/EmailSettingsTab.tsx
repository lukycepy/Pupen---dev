'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Save, Loader2, Server, User, ShieldCheck } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';

export default function EmailSettingsTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    smtp_host: 'smtp.pupen.org',
    smtp_port: 587,
    smtp_user: 'info@pupen.org',
    smtp_pass: '',
    smtp_secure: false,
    smtp_tls_reject_unauthorized: true,
    smtp_tls_ca_pem: '',
    imap_host: 'imap.pupen.org',
    imap_port: 993,
    imap_user: 'info@pupen.org',
    imap_pass: '',
    imap_secure: true,
    sender_name: 'Pupen Control',
    sender_email: 'info@pupen.org',
    application_notification_emails: [] as string[],
    application_notification_emails_new: [] as string[],
    application_notification_emails_status: [] as string[],
    dkim_selector: '',
  });

  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsResult, setDnsResult] = useState<any>(null);

  const [testStatusLoading, setTestStatusLoading] = useState(false);
  const [testStatusResult, setTestStatusResult] = useState<any>(null);

  const senderDomain = String(settings.sender_email || '').includes('@') ? String(settings.sender_email).split('@').pop() : '';

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('email_settings')
          .select('*')
          .single();
        
        if (data && !error) {
          setSettings(data);
        }
      } catch (err) {
        console.error('Failed to fetch email settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_settings')
        .upsert(settings);

      if (error) throw error;
      showToast('Nastavení e-mailu uloženo', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonTabContent />;

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

  const checkDns = async () => {
    setDnsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/email/deliverability', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Kontrola DNS selhala');
      setDnsResult(j);
    } catch (e: any) {
      setDnsResult({ ok: false, error: String(e?.message || e) });
    } finally {
      setDnsLoading(false);
    }
  };

  const sendStatusTest = async (status: 'approved' | 'rejected') => {
    setTestStatusLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/applications/status-email/test-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lang: dict?.lang === 'en' ? 'en' : 'cs', status }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Test selhal');
      setTestStatusResult(j);
      showToast(`Test notifikace odeslána (${status})`, 'success');
    } catch (e: any) {
      setTestStatusResult({ ok: false, error: String(e?.message || e) });
      showToast(String(e?.message || e), 'error');
    } finally {
      setTestStatusLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title="Nastavení e-mailu"
        description="Konfigurace SMTP/IMAP a identity odesílatele pro Pupen Control."
        actions={
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl border border-stone-100">
            <Mail size={16} className="text-green-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">SuperAdmin</span>
          </div>
        }
      />

      <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-6">
        {/* SMTP SETTINGS */}
        <AdminPanel className="p-8 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2 text-stone-900">
            <Server className="text-green-600" size={20} />
            SMTP Server (Odesílání)
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Hostitel</label>
              <input 
                type="text" 
                value={settings.smtp_host}
                onChange={e => setSettings({...settings, smtp_host: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Port</label>
                <input 
                  type="number" 
                  value={settings.smtp_port}
                  onChange={e => setSettings({...settings, smtp_port: parseInt(e.target.value)})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Uživatel</label>
                <input 
                  type="text" 
                  value={settings.smtp_user}
                  onChange={e => setSettings({...settings, smtp_user: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
            </div>
            <div className="flex items-center justify-between bg-stone-50 rounded-2xl border border-stone-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Secure (TLS)</div>
                <div className="text-xs font-bold text-stone-600 mt-1 truncate">
                  {settings.smtp_port === 465 ? 'Doporučeno zapnout pro port 465.' : settings.smtp_port === 587 ? 'Typicky vypnuto pro STARTTLS na 587.' : 'Záleží na poskytovateli.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, smtp_secure: !settings.smtp_secure })}
                className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition ${
                  settings.smtp_secure ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {settings.smtp_secure ? 'Zapnuto' : 'Vypnuto'}
              </button>
            </div>
            {settings.smtp_port === 586 && (
              <div className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
                Port 586 je neobvyklý. Pokud posílání padá na timeout, často pomůže 587 (STARTTLS).
              </div>
            )}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Heslo</label>
              <input 
                type="password" 
                value={settings.smtp_pass}
                onChange={e => setSettings({...settings, smtp_pass: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            <div className="flex items-center justify-between bg-stone-50 rounded-2xl border border-stone-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ověřovat certifikát</div>
                <div className="text-xs font-bold text-stone-600 mt-1 truncate">
                  {settings.smtp_tls_reject_unauthorized ? 'Zapnuto (doporučeno).' : 'Vypnuto (nedoporučeno).'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, smtp_tls_reject_unauthorized: !settings.smtp_tls_reject_unauthorized })}
                className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition ${
                  settings.smtp_tls_reject_unauthorized
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {settings.smtp_tls_reject_unauthorized ? 'Zapnuto' : 'Vypnuto'}
              </button>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">TLS CA (PEM)</label>
              <textarea
                value={settings.smtp_tls_ca_pem || ''}
                onChange={e => setSettings({ ...settings, smtp_tls_ca_pem: e.target.value })}
                placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition min-h-[120px]"
              />
              <div className="mt-2 text-xs font-bold text-stone-500">
                Pokud SMTP padá na „unable to verify the first certificate“, vlož sem CA chain (PEM).
              </div>
            </div>
          </div>
        </AdminPanel>

        {/* IMAP SETTINGS */}
        <AdminPanel className="p-8 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2 text-stone-900">
            <Server className="text-green-600" size={20} />
            IMAP Server (Příjem)
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Hostitel</label>
              <input 
                type="text" 
                value={settings.imap_host}
                onChange={e => setSettings({...settings, imap_host: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Port</label>
                <input 
                  type="number" 
                  value={settings.imap_port}
                  onChange={e => setSettings({...settings, imap_port: parseInt(e.target.value)})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Uživatel</label>
                <input 
                  type="text" 
                  value={settings.imap_user}
                  onChange={e => setSettings({...settings, imap_user: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
            </div>
            <div className="flex items-center justify-between bg-stone-50 rounded-2xl border border-stone-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Secure (TLS)</div>
                <div className="text-xs font-bold text-stone-600 mt-1 truncate">
                  {settings.imap_port === 993 ? 'Typicky zapnuto pro port 993.' : 'Záleží na poskytovateli.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, imap_secure: !settings.imap_secure })}
                className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition ${
                  settings.imap_secure ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {settings.imap_secure ? 'Zapnuto' : 'Vypnuto'}
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Heslo</label>
              <input 
                type="password" 
                value={settings.imap_pass}
                onChange={e => setSettings({...settings, imap_pass: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
          </div>
        </AdminPanel>

        {/* SENDER INFO */}
        <AdminPanel className="p-8 space-y-6 md:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 text-stone-900">
            <User className="text-green-600" size={20} />
            Identita Odesílatele
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Jméno odesílatele</label>
              <input 
                type="text" 
                value={settings.sender_name}
                onChange={e => setSettings({...settings, sender_name: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">E-mail odesílatele</label>
              <input 
                type="email" 
                value={settings.sender_email}
                onChange={e => setSettings({...settings, sender_email: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className="p-8 space-y-4 md:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 text-stone-900">
            <Mail className="text-green-600" size={20} />
            Notifikace přihlášek
          </h3>
          <div className="text-xs font-bold text-stone-500">
            Zadejte e-maily (1 na řádek), které dostanou upozornění.
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Nová přihláška</div>
              <textarea
                value={(settings.application_notification_emails_new || settings.application_notification_emails || []).join('\n')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    application_notification_emails_new: e.target.value
                      .split(/\r?\n/g)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="predseda@pupen.org&#10;sekretariat@pupen.org"
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Změna stavu</div>
              <textarea
                value={(settings.application_notification_emails_status || []).join('\n')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    application_notification_emails_status: e.target.value
                      .split(/\r?\n/g)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="predseda@pupen.org"
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition min-h-[120px]"
              />
            </div>
          </div>
          <div className="text-[11px] font-bold text-stone-500">
            Pokud „Nová přihláška“ necháte prázdné, použije se fallback na admin profily. Staré pole zůstává kvůli kompatibilitě.
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => sendStatusTest('approved')}
              disabled={testStatusLoading}
              className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 transition"
            >
              {testStatusLoading ? 'Odesílám…' : 'Poslat test (schváleno)'}
            </button>
            <button
              type="button"
              onClick={() => sendStatusTest('rejected')}
              disabled={testStatusLoading}
              className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition"
            >
              {testStatusLoading ? 'Odesílám…' : 'Poslat test (zamítnuto)'}
            </button>
            {testStatusResult?.ok === true ? (
              <div className="text-xs font-black text-green-700">Odesláno na {Array.isArray(testStatusResult.recipients) ? testStatusResult.recipients.length : 0} příjemců</div>
            ) : testStatusResult?.error ? (
              <div className="text-xs font-black text-red-700">{String(testStatusResult.error)}</div>
            ) : null}
          </div>
        </AdminPanel>

        <AdminPanel className="p-8 space-y-5 md:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 text-stone-900">
            <ShieldCheck className="text-green-600" size={20} />
            Doručitelnost (SPF / DKIM / DMARC)
          </h3>
          <div className="text-xs font-bold text-stone-500">
            Tyto záznamy se nastavují v DNS domény odesílatele. Pupen může ukázat doporučení a zkontrolovat, že existují.
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">SPF</div>
              <div className="mt-2 text-xs font-bold text-stone-700 break-words">
                {senderDomain ? `TXT na ${senderDomain}` : 'TXT na doméně odesílatele'}
              </div>
              <div className="mt-2 text-[11px] font-bold text-stone-500">
                Nastavte SPF podle SMTP providera (typicky v=spf1 … ~all / -all).
              </div>
            </div>
            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">DKIM</div>
              <div className="mt-2 text-xs font-bold text-stone-700 break-words">
                {senderDomain ? `TXT na selector._domainkey.${senderDomain}` : 'TXT na selector._domainkey.doména'}
              </div>
              <div className="mt-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Selector (volitelné)</label>
                <input
                  type="text"
                  value={String((settings as any).dkim_selector || '')}
                  onChange={(e) => setSettings({ ...(settings as any), dkim_selector: e.target.value })}
                  placeholder="např. s1, mail, default"
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
            </div>
            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">DMARC</div>
              <div className="mt-2 text-xs font-bold text-stone-700 break-words">
                {senderDomain ? `TXT na _dmarc.${senderDomain}` : 'TXT na _dmarc.doména'}
              </div>
              <div className="mt-2 text-[11px] font-bold text-stone-500">
                Doporučený start: p=none (reporting), pak zpřísnit na quarantine/reject.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={checkDns}
              disabled={dnsLoading}
              className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 transition"
            >
              {dnsLoading ? 'Kontroluji…' : 'Zkontrolovat DNS'}
            </button>
            {dnsResult?.ok === true ? (
              <div className="text-xs font-black text-green-700">DNS OK</div>
            ) : dnsResult?.error ? (
              <div className="text-xs font-black text-red-700">{String(dnsResult.error)}</div>
            ) : null}
          </div>

          {dnsResult?.ok === true && (
            <div className="grid md:grid-cols-3 gap-4 text-xs font-bold">
              <div className={`rounded-2xl p-4 border ${dnsResult?.spf?.ok ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                SPF: {dnsResult?.spf?.ok ? 'nalezeno' : 'nenalezeno'}
              </div>
              <div className={`rounded-2xl p-4 border ${dnsResult?.dkim?.ok ? 'bg-green-50 border-green-100 text-green-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                DKIM: {dnsResult?.dkim?.ok ? 'nalezeno' : 'neověřeno'}
              </div>
              <div className={`rounded-2xl p-4 border ${dnsResult?.dmarc?.ok ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                DMARC: {dnsResult?.dmarc?.ok ? 'nalezeno' : 'nenalezeno'}
              </div>
            </div>
          )}
        </AdminPanel>

        <div className="md:col-span-2">
          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
            Uložit nastavení e-mailu
          </button>
        </div>
      </form>
    </div>
  );
}
