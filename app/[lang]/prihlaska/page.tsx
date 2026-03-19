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

export default function PrihlaskaPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();
  
  const [dict, setDict] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    birth_date: '',
    email: '',
    phone: '',
    faculty_info: '',
    motivation: '',
    applicant_signature: ''
  });

  useEffect(() => {
    getDictionary(lang).then(d => setDict(d.recruitment));
  }, [lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.applicant_signature) {
      return showToast(lang === 'cs' ? 'Prosím připojte svůj podpis.' : 'Please provide your signature.', 'error');
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('applications').insert([formData]);
      if (error) throw error;
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
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelFullName}</label>
              <input 
                required
                type="text" 
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelBirthDate}</label>
              <input 
                required
                type="date" 
                value={formData.birth_date}
                onChange={e => setFormData({...formData, birth_date: e.target.value})}
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
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelFaculty}</label>
            <input 
              required
              type="text" 
              placeholder={dict.placeholderFaculty}
              value={formData.faculty_info}
              onChange={e => setFormData({...formData, faculty_info: e.target.value})}
              className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelMotivation}</label>
            <textarea 
              required
              rows={4}
              value={formData.motivation}
              onChange={e => setFormData({...formData, motivation: e.target.value})}
              className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-green-500 transition font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelSignature}</label>
            <SignaturePad 
              onSave={dataUrl => setFormData({...formData, applicant_signature: dataUrl})}
              onClear={() => setFormData({...formData, applicant_signature: ''})}
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
