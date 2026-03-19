'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { ArrowLeft, Download, FileText } from 'lucide-react';

export default function MyApplicationPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  const { data, isLoading } = useQuery({
    queryKey: ['member_my_application'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const email = session.session?.user?.email;
      if (!email) return { email: null, application: null };
      const res = await supabase
        .from('applications')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1);
      if (res.error) throw res.error;
      return { email, application: res.data?.[0] || null };
    },
  });

  const application = data?.application;

  const print = () => window.print();

  return (
    <div className="min-h-screen bg-stone-50 font-sans p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            href={`/${lang}/clen`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            <ArrowLeft size={16} />
            {lang === 'en' ? 'Back' : 'Zpět'}
          </Link>
          <button
            type="button"
            onClick={print}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            <Download size={16} />
            {lang === 'en' ? 'Print / Save PDF' : 'Tisk / Uložit PDF'}
          </button>
        </div>

        <div className="bg-white rounded-[3rem] border border-stone-100 shadow-sm p-10 md:p-16">
          <div className="flex items-start justify-between gap-6 mb-10">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-3">
                {lang === 'en' ? 'Application' : 'Přihláška'}
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight flex items-center gap-3">
                <FileText className="text-green-600" />
                {lang === 'en' ? 'My application' : 'Moje přihláška'}
              </h1>
              <p className="text-stone-500 font-medium mt-4">
                {lang === 'en'
                  ? 'You can print this page to PDF.'
                  : 'Tuto stránku můžete vytisknout do PDF.'}
              </p>
            </div>
            {application?.status && (
              <span
                className={`inline-flex items-center rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-widest ${
                  application.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : application.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {application.status}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="py-20 flex items-center justify-center">
              <InlinePulse className="bg-stone-200" size={18} />
            </div>
          ) : !data?.email ? (
            <div className="py-20 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              {lang === 'en' ? 'Please log in.' : 'Přihlaste se.'}
            </div>
          ) : !application ? (
            <div className="py-20 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              {lang === 'en' ? 'No application found.' : 'Přihláška nebyla nalezena.'}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: 'Jméno', value: application.first_name },
                  { label: 'Příjmení', value: application.last_name },
                  { label: 'Email', value: application.email },
                  { label: 'Telefon', value: application.phone },
                  { label: 'Ročník', value: application.year },
                  { label: 'Obor', value: application.field_of_study },
                ].map((f, i) => (
                  <div key={i} className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                      {f.label}
                    </div>
                    <div className="text-sm font-bold text-stone-800">{f.value || '—'}</div>
                  </div>
                ))}
              </div>

              <div className="bg-stone-50 border border-stone-100 rounded-2xl p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
                  {lang === 'en' ? 'Signatures' : 'Podpisy'}
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-stone-100 rounded-2xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
                      {lang === 'en' ? 'Applicant' : 'Žadatel'}
                    </div>
                    {application.applicant_signature ? (
                      <Image
                        src={application.applicant_signature}
                        alt="Applicant signature"
                        width={640}
                        height={160}
                        unoptimized
                        className="w-full max-h-40 object-contain bg-stone-50 rounded-xl border border-stone-100"
                      />
                    ) : (
                      <div className="h-40 flex items-center justify-center text-stone-300 font-black uppercase tracking-widest text-xs border border-stone-100 rounded-xl">
                        —
                      </div>
                    )}
                  </div>
                  <div className="bg-white border border-stone-100 rounded-2xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
                      {lang === 'en' ? 'Chairwoman' : 'Předsedkyně'}
                    </div>
                    {application.chairwoman_signature ? (
                      <Image
                        src={application.chairwoman_signature}
                        alt="Chairwoman signature"
                        width={640}
                        height={160}
                        unoptimized
                        className="w-full max-h-40 object-contain bg-stone-50 rounded-xl border border-stone-100"
                      />
                    ) : (
                      <div className="h-40 flex items-center justify-center text-stone-300 font-black uppercase tracking-widest text-xs border border-stone-100 rounded-xl">
                        —
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                {application.created_at ? new Date(application.created_at).toLocaleString('cs-CZ') : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
