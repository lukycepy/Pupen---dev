'use client'; 

import React, { useState, useEffect } from 'react';
import { Mail, Instagram, MapPin, Send, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getDictionary } from '@/lib/get-dictionary';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactFormSchema, type ContactFormData } from '@/lib/validations/contact';
import { useToast } from '@/app/context/ToastContext';

export default function KontaktPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [dict, setDict] = useState<any>(null);
  
  const [honeyPot, setHoneyPot] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0, userAnswer: '' });

  const [dictGlobal, setDictGlobal] = useState<any>(null);

  const { register, handleSubmit: hookFormSubmit, reset, formState: { errors } } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: ''
    }
  });

  useEffect(() => {
    async function loadData() {
      const d = await getDictionary(lang);
      setDict(d.contactPage);
      setDictGlobal(d.footer);
    }
    loadData();
    setStartTime(Date.now());
    generateCaptcha();
  }, [lang]);

  const generateCaptcha = () => {
    setCaptcha({
      num1: Math.floor(Math.random() * 10),
      num2: Math.floor(Math.random() * 10),
      userAnswer: ''
    });
  };

  const onSubmit = async (data: ContactFormData) => {
    if (honeyPot !== '' || (Date.now() - startTime < 2000)) {
      setStatus('success'); 
      return;
    }

    const correctAnswer = captcha.num1 + captcha.num2;
    if (parseInt(captcha.userAnswer) !== correctAnswer) {
      showToast(`${dict.captchaAlert} ${captcha.num1} + ${captcha.num2}`, 'error');
      generateCaptcha();
      return;
    }

    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, website: honeyPot }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');

      setStatus('success');
      reset();
      generateCaptcha();
    } catch (e: any) {
      setStatus('error');
      setErrorMessage(e.message || dict.errorText);
    } finally {
      setLoading(false);
    }
  };

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
        
        {/* Hlavní nadpis */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-stone-900 mb-4">
            {dict.title}
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            {dict.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          
          {/* LEVÁ STRANA: Kontaktní karty */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-stone-200/50 flex items-start gap-4 hover:-translate-y-1 transition duration-300">
              <div className="bg-green-100 p-3 rounded-full text-green-600"><Mail size={24} /></div>
              <div>
                <h3 className="text-xl font-bold mb-1">{dict.emailTitle}</h3>
                <p className="text-stone-500 mb-2">{dict.emailSub}</p>
                <a href={`mailto:${dictGlobal?.contactEmail || 'info@pupen.org'}`} className="text-green-600 font-semibold hover:underline">{dictGlobal?.contactEmail || 'info@pupen.org'}</a>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-stone-200/50 flex items-start gap-4 hover:-translate-y-1 transition duration-300">
              <div className="bg-green-100 p-3 rounded-full text-green-600"><Instagram size={24} /></div>
              <div>
                <h3 className="text-xl font-bold mb-1">{dict.socialTitle}</h3>
                <p className="text-stone-500 mb-2">{dict.socialSub}</p>
                <a href="https://instagram.com/pupenfappz/" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">@pupenfappz</a>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-stone-200/50 flex items-start gap-4 hover:-translate-y-1 transition duration-300">
              <div className="bg-green-100 p-3 rounded-full text-green-600"><MapPin size={24} /></div>
              <div>
                <h3 className="text-xl font-bold mb-1">{dict.addressTitle}</h3>
                <p className="text-stone-500 whitespace-pre-line leading-relaxed">{dict.addressText}</p>
              </div>
            </div>
          </div>

          {/* PRAVÁ STRANA: Formulář */}
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl shadow-stone-200/50">
            <h2 className="text-2xl font-bold mb-6">{dict.formTitle}</h2>
            
            {status === 'success' ? (
              <div className="bg-green-50 p-6 rounded-xl text-center border border-green-200 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-center mb-4"><CheckCircle size={48} className="text-green-600" /></div>
                <h3 className="text-xl font-bold text-green-800 mb-2">{dict.successTitle}</h3>
                <p className="text-green-700">{dict.successText}</p>
                <button onClick={() => setStatus('idle')} className="mt-4 text-sm font-bold underline hover:text-green-900 transition">{dict.sendAnother}</button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={hookFormSubmit(onSubmit)}>
                <input type="text" name="website" value={honeyPot} onChange={(e) => setHoneyPot(e.target.value)} className="opacity-0 absolute -z-10 w-0 h-0" tabIndex={-1} autoComplete="off" />

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-stone-600">{dict.labelName}</label>
                    <input {...register('name')} type="text" className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 transition" placeholder={dict.placeholderName} />
                    {errors.name && <p className="text-red-500 text-xs font-bold">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-stone-600">{dict.labelEmail}</label>
                    <input {...register('email')} type="email" className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 transition" placeholder="jan@example.com" />
                    {errors.email && <p className="text-red-500 text-xs font-bold">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-600">{dict.labelSubject}</label>
                  <input {...register('subject')} type="text" className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 transition" placeholder={dict.placeholderSubject} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-600">{dict.labelMessage}</label>
                  <textarea {...register('message')} rows={4} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 transition resize-none" placeholder={dict.placeholderMessage}></textarea>
                  {errors.message && <p className="text-red-500 text-xs font-bold">{errors.message.message}</p>}
                </div>

                {/* MATEMATICKÁ CAPTCHA */}
                <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck size={18} className="text-green-600" />
                      <label className="text-sm font-bold text-stone-700">{dict.captchaLabel}</label>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-stone-900 bg-white px-3 py-1 rounded border border-stone-200">
                        {captcha.num1} + {captcha.num2} = ?
                      </span>
                      <input 
                        type="number" 
                        required
                        value={captcha.userAnswer}
                        onChange={(e) => setCaptcha({...captcha, userAnswer: e.target.value})}
                        className="w-20 bg-white border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 font-bold text-center"
                        placeholder="?"
                      />
                    </div>
                </div>

                {status === 'error' && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm font-bold border border-red-100">
                    <AlertCircle size={18} /> {errorMessage || dict.errorText}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 mt-4 shadow-lg shadow-green-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                   <Send size={18} />
                  {loading ? dict.btnSending : dict.btnSend}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
