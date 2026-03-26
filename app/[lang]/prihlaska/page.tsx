'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getDictionary } from '@/lib/get-dictionary';
import { supabase } from '@/lib/supabase';
import { useToast } from '../../context/ToastContext';
import SignaturePad from '../components/SignaturePad';
import { UserPlus, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import InlinePulse from '@/app/components/InlinePulse';
import AddressAutocomplete from '@/app/components/AddressAutocomplete';

export default function PrihlaskaPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();
  
  const [dict, setDict] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    membership_type: 'regular' as 'regular' | 'external',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    university_email: '',
    field_of_study: '',
    study_year: '',
    signed_on: '',
    gdpr_consent: false,
    applicant_signature: '',
  });
  const [addressMeta, setAddressMeta] = useState<any>(null);

  useEffect(() => {
    getDictionary(lang).then(d => setDict(d.recruitment));
  }, [lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.gdpr_consent) {
      return showToast(dict.errorConsentRequired, 'error');
    }
    if (!formData.applicant_signature) {
      return showToast(dict.errorSignatureRequired, 'error');
    }
    if (formData.membership_type === 'regular') {
      if (!formData.university_email || !formData.field_of_study || !formData.study_year) {
        return showToast(dict.errorRegularFieldsRequired, 'error');
      }
    }

    setLoading(true);
    try {
      let validatedAddress = String(formData.address || '').trim();
      let validatedMeta: any = addressMeta;
      if (validatedAddress) {
        const res = await fetch('/api/address/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: validatedAddress, lang }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          showToast(lang === 'en' ? 'Please enter a valid address.' : 'Zadejte prosím platnou adresu.', 'error');
          setLoading(false);
          return;
        }
        validatedAddress = String(json?.address || validatedAddress);
        validatedMeta = json?.meta || validatedMeta;
      }

      const full_name = `${formData.first_name} ${formData.last_name}`.trim();
      const payload: any = {
        full_name,
        name: full_name,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        address: validatedAddress || null,
        address_meta: validatedMeta || {},
        address_validated_at: validatedAddress ? new Date().toISOString() : null,
        membership_type: formData.membership_type,
        university_email: formData.membership_type === 'regular' ? formData.university_email : null,
        field_of_study: formData.membership_type === 'regular' ? formData.field_of_study : null,
        study_year: formData.membership_type === 'regular' ? formData.study_year : null,
        signed_on: formData.signed_on || null,
        gdpr_consent: true,
        signature_data_url: formData.applicant_signature,
        applicant_signature: formData.applicant_signature,
        faculty: formData.membership_type === 'regular' ? `${formData.field_of_study}, ${formData.study_year}` : null,
        status: 'pending',
      };
      const { error } = await supabase.from('applications').insert([payload]);
      if (error) throw error;
      
      // Notify admins about new application
      try {
        await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Systém Spolku Pupen',
            email: 'noreply@pupen.org',
            hp: '',
            subject: 'Nová přihláška do spolku',
            message: `Byla podána nová přihláška.\n\nJméno: ${full_name}\nE-mail: ${formData.email}\nTyp: ${formData.membership_type === 'regular' ? 'Řádný člen' : 'Externista'}\n\nZkontrolujte ji v administraci v sekci Přihlášky.`
          })
        });
      } catch (e) {
        console.error('Failed to notify admins:', e);
      }
      
      setSuccess(true);
      showToast(dict.successTitle, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!dict) return null;

  if (success) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-xl text-center animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <CheckCircle size={40} />
          </div>
          <h1 className="text-3xl font-black text-stone-900 mb-4">{dict.successTitle}</h1>
          <p className="text-stone-500 mb-8 font-medium">{dict.successDesc}</p>
          <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 text-left mb-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
              {lang === 'en' ? 'What happens next' : 'Co bude dál'}
            </div>
            <div className="space-y-2 text-sm font-medium text-stone-700">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-xl bg-white border border-stone-100 flex items-center justify-center font-black text-stone-400 shrink-0">1</div>
                <div>{lang === 'en' ? 'Admins will review your application.' : 'Administrátoři přihlášku zkontrolují.'}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-xl bg-white border border-stone-100 flex items-center justify-center font-black text-stone-400 shrink-0">2</div>
                <div>
                  {lang === 'en'
                    ? 'After approval you will receive an email with access to the member portal.'
                    : 'Po schválení přijde e-mail s přístupem do členské sekce.'}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-xl bg-white border border-stone-100 flex items-center justify-center font-black text-stone-400 shrink-0">3</div>
                <div>
                  {lang === 'en'
                    ? 'You can check your application status in the member portal after you sign in.'
                    : 'Stav přihlášky uvidíte po přihlášení v členské sekci.'}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href={`/${lang}/login`}
                className="inline-flex items-center justify-center bg-white text-stone-700 px-4 py-3 rounded-2xl font-bold hover:bg-stone-100 transition border border-stone-200 text-xs"
              >
                {lang === 'en' ? 'Sign in' : 'Přihlásit se'}
              </Link>
              <Link
                href={`/${lang}/clen`}
                className="inline-flex items-center justify-center bg-stone-900 text-white px-4 py-3 rounded-2xl font-bold hover:bg-green-600 transition text-xs"
              >
                {lang === 'en' ? 'Member portal' : 'Členská sekce'}
              </Link>
            </div>
          </div>
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 bg-green-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-100">
            <ArrowLeft size={18} /> {dict.backHome}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-3xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6 shadow-sm">
            <UserPlus size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-stone-100 space-y-8">
          <div className="space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.membershipTypeLabel}</div>
            <div className="grid md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, membership_type: 'regular' })}
                className={`px-6 py-5 rounded-2xl border text-left transition ${
                  formData.membership_type === 'regular'
                    ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-600/20'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-widest">{dict.membershipRegularTitle}</div>
                <div className={`mt-2 text-sm font-bold ${formData.membership_type === 'regular' ? 'text-white/90' : 'text-stone-500'}`}>
                  {dict.membershipRegularDesc}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, membership_type: 'external' })}
                className={`px-6 py-5 rounded-2xl border text-left transition ${
                  formData.membership_type === 'external'
                    ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-600/20'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-widest">{dict.membershipExternalTitle}</div>
                <div className={`mt-2 text-sm font-bold ${formData.membership_type === 'external' ? 'text-white/90' : 'text-stone-500'}`}>
                  {dict.membershipExternalDesc}
                </div>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelFirstName}</label>
              <input 
                required
                type="text"
                value={formData.first_name}
                onChange={e => setFormData({...formData, first_name: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelLastName}</label>
              <input 
                required
                type="text"
                value={formData.last_name}
                onChange={e => setFormData({...formData, last_name: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelEmail}</label>
              <input 
                required
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelPhone}</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelAddress}</label>
              <AddressAutocomplete
                lang={lang}
                value={formData.address}
                onChange={(v) => setFormData({ ...formData, address: v })}
                onSelect={(it) => setAddressMeta(it)}
                inputClassName="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
              />
            </div>
          </div>

          {formData.membership_type === 'regular' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelUniversityEmail}</label>
                <input 
                  required
                  type="email"
                  value={formData.university_email}
                  onChange={e => setFormData({...formData, university_email: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelStudyYear}</label>
                <input 
                  required
                  type="text"
                  value={formData.study_year}
                  onChange={e => setFormData({...formData, study_year: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelFieldOfStudy}</label>
                <input 
                  required
                  type="text"
                  value={formData.field_of_study}
                  onChange={e => setFormData({...formData, field_of_study: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelSignedOn}</label>
            <input
              type="date"
              value={formData.signed_on}
              onChange={e => setFormData({ ...formData, signed_on: e.target.value })}
              className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
            />
          </div>

          <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.gdpr_consent}
                onChange={(e) => setFormData({ ...formData, gdpr_consent: e.target.checked })}
                className="mt-1 w-5 h-5 accent-green-600"
              />
              <div className="min-w-0">
                <div className="font-bold text-stone-800">{dict.consentLabel}</div>
                <div className="text-sm text-stone-500 font-medium mt-1 leading-relaxed">{dict.consentHelp}</div>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelSignature}</label>
            <SignaturePad 
              onSave={dataUrl => setFormData({...formData, applicant_signature: dataUrl})}
              onClear={() => setFormData({...formData, applicant_signature: ''})}
              clearLabel={dict.btnClear}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-green-700 transition shadow-xl shadow-green-100 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? <InlinePulse className="bg-white/80" size={16} /> : <CheckCircle size={24} />}
            {dict.btnSubmit}
          </button>
        </form>
      </div>
    </div>
  );
}
