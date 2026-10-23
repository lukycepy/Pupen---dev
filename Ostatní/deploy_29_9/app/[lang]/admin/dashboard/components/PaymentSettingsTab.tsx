'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Save, Loader2, Landmark, Mail, Key, Globe, CreditCard, Hash } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';

export default function PaymentSettingsTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    bank_account: '',
    integration_type: 'mail', // 'fio' | 'mail' | 'vs'
    fio_api_token: '',
    notification_email: ''
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('payment_settings')
          .select('*')
          .single();
        
        if (data && !error) {
          setSettings(data);
        }
      } catch (err) {
        console.error('Failed to fetch payment settings:', err);
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
      // In a real app, you would have a 'payment_settings' table.
      // If it doesn't exist yet, this might fail unless created in Supabase.
      const { error } = await supabase
        .from('payment_settings')
        .upsert({
          id: 1, // Ensure single row
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      showToast(dict.admin.paymentSettings?.saveSuccess || 'Nastavení plateb uloženo', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonTabContent />;

  const t = dict.admin.paymentSettings;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={t?.title || 'Platební nastavení'}
        description={t?.subtitle || 'Správa bankovního účtu a automatizace plateb'}
        actions={
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl border border-stone-100">
            <ShieldCheck size={16} className="text-green-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t?.superAdminAccess || 'SuperAdmin přístup'}</span>
          </div>
        }
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* BANK ACCOUNT */}
        <AdminPanel className="p-8 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2 text-stone-900">
            <Landmark className="text-green-600" size={20} />
            {t?.bankAccountTitle || 'Bankovní účet spolku'}
          </h3>
          <div className="max-w-md">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{t?.bankAccountLabel || 'Číslo účtu (včetně kódu banky)'}</label>
            <div className="relative mt-1">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                value={settings.bank_account}
                onChange={e => setSettings({...settings, bank_account: e.target.value})}
                placeholder={t?.bankAccountPlaceholder || "Např. 123456789/2010"}
                className="w-full bg-stone-50 border-none pl-12 pr-4 py-4 rounded-2xl font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition shadow-inner"
              />
            </div>
            <p className="text-[10px] text-stone-400 mt-2 px-1">{t?.bankAccountHelp || 'Tento účet se bude zobrazovat členům v přihlášce a na výzvách k platbě.'}</p>
          </div>
        </AdminPanel>

        {/* INTEGRATION TYPE */}
        <AdminPanel className="p-8 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2 text-stone-900">
            <Globe className="text-green-600" size={20} />
            {t?.pairingTitle || 'Způsob párování plateb'}
          </h3>
          
          <div className="grid md:grid-cols-3 gap-4">
            {/* MAIL OPTION */}
            <button 
              type="button"
              onClick={() => setSettings({...settings, integration_type: 'mail'})}
              className={`p-6 rounded-[2rem] border-2 text-left transition-all duration-300 ${
                settings.integration_type === 'mail' 
                  ? 'border-green-600 bg-green-50/30 ring-4 ring-green-100' 
                  : 'border-stone-100 bg-stone-50 hover:bg-white hover:border-stone-200'
              }`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  settings.integration_type === 'mail' ? 'bg-green-600 text-white' : 'bg-white text-stone-400 border border-stone-100'
                }`}>
                  <Mail size={24} />
                </div>
                <div>
                  <h4 className="font-black text-stone-900 leading-none">{t?.pairingMailTitle || 'E-mailová komunikace'}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">{t?.pairingMailSub || 'Manuální potvrzení'}</p>
                </div>
              </div>
              <p className="text-xs text-stone-500 font-medium leading-relaxed">
                {t?.pairingMailDesc || 'Platby jsou potvrzovány ručně administrátorem na základě e-mailových notifikací z banky.'}
              </p>
            </button>

            {/* VS OPTION */}
            <button 
              type="button"
              onClick={() => setSettings({...settings, integration_type: 'vs'})}
              className={`p-6 rounded-[2rem] border-2 text-left transition-all duration-300 ${
                settings.integration_type === 'vs' 
                  ? 'border-green-600 bg-green-50/30 ring-4 ring-green-100' 
                  : 'border-stone-100 bg-stone-50 hover:bg-white hover:border-stone-200'
              }`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  settings.integration_type === 'vs' ? 'bg-green-600 text-white' : 'bg-white text-stone-400 border border-stone-100'
                }`}>
                  <Hash size={24} />
                </div>
                <div>
                  <h4 className="font-black text-stone-900 leading-none">{t?.pairingVsTitle || 'Automaticky dle VS'}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">{t?.pairingVsSub || 'Číslo objednávky'}</p>
                </div>
              </div>
              <p className="text-xs text-stone-500 font-medium leading-relaxed">
                {t?.pairingVsDesc || 'Platby jsou párovány automaticky na základě variabilního symbolu vstupenek.'}
              </p>
            </button>

            {/* FIO OPTION */}
            <button 
              type="button"
              onClick={() => setSettings({...settings, integration_type: 'fio'})}
              className={`p-6 rounded-[2rem] border-2 text-left transition-all duration-300 ${
                settings.integration_type === 'fio' 
                  ? 'border-green-600 bg-green-50/30 ring-4 ring-green-100' 
                  : 'border-stone-100 bg-stone-50 hover:bg-white hover:border-stone-200'
              }`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  settings.integration_type === 'fio' ? 'bg-green-600 text-white' : 'bg-white text-stone-400 border border-stone-100'
                }`}>
                  <Key size={24} />
                </div>
                <div>
                  <h4 className="font-black text-stone-900 leading-none">{t?.pairingFioTitle || 'Fio API (Automaticky)'}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">{t?.pairingFioSub || 'Plně automatizováno'}</p>
                </div>
              </div>
              <p className="text-xs text-stone-500 font-medium leading-relaxed">
                {t?.pairingFioDesc || 'Systém se automaticky spojí s Fio bankou a spáruje platby podle variabilního symbolu.'}
              </p>
            </button>
          </div>

          {/* DYNAMIC FIELDS BASED ON SELECTION */}
          <div className="mt-8 pt-8 border-t border-stone-100 animate-in fade-in duration-500">
            {settings.integration_type === 'fio' ? (
              <div className="max-w-md space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-stone-900">{t?.configApi || 'API Konfigurace'}</h4>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{t?.configApiTokenLabel || 'Fio API Token (Read-only)'}</label>
                  <div className="relative mt-1">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input 
                      type="password" 
                      value={settings.fio_api_token}
                      onChange={e => setSettings({...settings, fio_api_token: e.target.value})}
                      placeholder={t?.configApiTokenPlaceholder || "Váš API token z IB Fio banky"}
                      className="w-full bg-stone-50 border-none pl-12 pr-4 py-4 rounded-2xl font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition shadow-inner"
                    />
                  </div>
                  <p className="text-[9px] text-stone-400 mt-2 px-1">{t?.configApiTokenHelp || 'Token naleznete v nastavení Fio banky v sekci API. Doporučujeme použít token pouze pro čtení.'}</p>
                </div>
              </div>
            ) : (
              <div className="max-w-md space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-stone-900">{t?.configNotifications || 'Konfigurace notifikací'}</h4>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{t?.configEmailLabel || 'E-mail pro zasílání výpisů'}</label>
                  <input 
                    type="email" 
                    value={settings.notification_email}
                    onChange={e => setSettings({...settings, notification_email: e.target.value})}
                    placeholder="pokladnik@pupen.org"
                    className="w-full bg-stone-50 border-none px-4 py-4 rounded-2xl font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition shadow-inner"
                  />
                </div>
              </div>
            )}
          </div>
        </AdminPanel>

        {/* SAVE BUTTON */}
        <div className="flex justify-end pt-4">
          <button 
            type="submit"
            disabled={saving}
            className="bg-green-600 text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-all shadow-xl shadow-green-600/20 flex items-center gap-3 disabled:opacity-50"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {t?.btnSave || 'Uložit konfiguraci plateb'}
          </button>
        </div>
      </form>
    </div>
  );
}
