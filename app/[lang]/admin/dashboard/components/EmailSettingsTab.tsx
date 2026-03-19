'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, ShieldCheck, Save, Loader2, Server, Key, User } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';

export default function EmailSettingsTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    smtp_host: 'smtp.pupen.org',
    smtp_port: 587,
    smtp_user: 'info@pupen.org',
    smtp_pass: '',
    imap_host: 'imap.pupen.org',
    imap_port: 993,
    imap_user: 'info@pupen.org',
    imap_pass: '',
    sender_name: 'Pupen Control',
    sender_email: 'info@pupen.org'
  });

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

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Mail className="text-green-600" />
          Nastavení E-mailu (SuperAdmin)
        </h2>
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-50 px-3 py-1 rounded-full border">
          Systémový e-mail
        </span>
      </div>

      <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-6">
        {/* SMTP SETTINGS */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
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
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Heslo</label>
              <input 
                type="password" 
                value={settings.smtp_pass}
                onChange={e => setSettings({...settings, smtp_pass: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
          </div>
        </div>

        {/* IMAP SETTINGS */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
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
        </div>

        {/* SENDER INFO */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 md:col-span-2">
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
        </div>

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
