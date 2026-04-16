'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';

export default function MyApplicationPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [dict, setDict] = useState<any>(null);

  useEffect(() => {
    getDictionary(lang).then((d) => setDict(d));
  }, [lang]);

  const { data, isLoading } = useQuery({
    queryKey: ['member_my_application'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return { email: null, application: null };
      const res = await fetch('/api/member/my-application', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return { email: session.session?.user?.email || null, application: json?.application || null };
    },
  });

  const application = data?.application;

  const print = () => window.print();
  const downloadPdf = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error(isEn ? 'Unauthorized' : 'Nepřihlášen');
      const res = await fetch('/api/member/my-application/pdf', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Chyba');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prihlaska_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      print();
    }
  };
  const isEn = lang === 'en';

  const statusLabel =
    application?.status === 'approved'
      ? isEn
        ? 'Approved'
        : 'Schváleno'
      : application?.status === 'rejected'
        ? isEn
          ? 'Rejected'
          : 'Odmítnuto'
        : isEn
          ? 'Pending'
          : 'Čeká';

  const membershipTypeLabel =
    application?.membership_type !== 'external'
      ? isEn
        ? 'Regular'
        : 'Řádné'
      : isEn
        ? 'External'
        : 'Externí';

  return (
    <div className="min-h-screen bg-stone-50 font-sans p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            href={`/${lang}/clen`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            <ArrowLeft size={16} />
            {isEn ? 'Back' : 'Zpět'}
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={print}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              <Download size={16} />
              {isEn ? 'Print / Save PDF' : 'Tisk / Uložit PDF'}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 transition"
            >
              <Download size={16} />
              {isEn ? 'Download PDF' : 'Stáhnout PDF'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-stone-100 shadow-sm p-10 md:p-16">
          <div className="flex items-start justify-between gap-6 mb-10">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-3">
                {isEn ? 'Application' : 'Přihláška'}
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight flex items-center gap-3">
                <FileText className="text-green-600" />
                {isEn ? 'My application' : 'Moje přihláška'}
              </h1>
              <p className="text-stone-500 font-medium mt-4">
                {isEn
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
                {statusLabel}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="py-20 flex items-center justify-center">
              <InlinePulse className="bg-stone-200" size={18} />
            </div>
          ) : !data?.email ? (
            <div className="py-20 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              {isEn ? 'Please log in.' : 'Přihlaste se.'}
            </div>
          ) : !application ? (
            <div className="py-20 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              {isEn ? 'No application found.' : 'Přihláška nebyla nalezena.'}
            </div>
          ) : (
            <div className="space-y-8">
              {(() => {
                const createdAt = application.created_at ? new Date(application.created_at) : null;
                const decidedAt = application.decided_at ? new Date(application.decided_at) : null;
                const isPending = application.status === 'pending';
                const isApproved = application.status === 'approved';
                const isRejected = application.status === 'rejected';

                const steps = [
                  { k: 'submitted', label: isEn ? 'Submitted' : 'Odesláno', done: true, at: createdAt },
                  { k: 'review', label: isEn ? 'Under review' : 'Posuzování', done: true, at: null },
                  {
                    k: 'decision',
                    label: isApproved ? (isEn ? 'Approved' : 'Schváleno') : isRejected ? (isEn ? 'Rejected' : 'Odmítnuto') : isEn ? 'Pending' : 'Čeká',
                    done: !isPending,
                    at: decidedAt,
                  },
                  { k: 'access', label: isEn ? 'Access email' : 'E-mail s přístupem', done: isApproved, at: null },
                ];

                return (
                  <div className="bg-stone-50 border border-stone-100 rounded-2xl p-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                      {isEn ? 'Status timeline' : 'Stavová timeline'}
                    </div>
                    <div className="grid md:grid-cols-4 gap-3">
                      {steps.map((s, idx) => (
                        <div key={s.k} className="bg-white border border-stone-100 rounded-2xl p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">#{idx + 1}</div>
                            <div
                              className={`w-8 h-8 rounded-2xl flex items-center justify-center font-black ${
                                s.done ? 'bg-green-600 text-white' : 'bg-stone-50 text-stone-300 border border-stone-100'
                              }`}
                            >
                              {s.done ? '✓' : '•'}
                            </div>
                          </div>
                          <div className="mt-3 font-black text-stone-900">{s.label}</div>
                          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                            {s.at && !Number.isNaN(s.at.getTime()) ? s.at.toLocaleString(isEn ? 'en-US' : 'cs-CZ') : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: isEn ? 'Membership type' : 'Typ členství', value: membershipTypeLabel },
                  { label: isEn ? 'First name' : 'Jméno', value: application.first_name },
                  { label: isEn ? 'Last name' : 'Příjmení', value: application.last_name },
                  { label: isEn ? 'Email' : 'Email', value: application.email },
                  { label: isEn ? 'Phone' : 'Telefon', value: application.phone },
                  { label: isEn ? 'University email' : 'Univerzitní email', value: application.university_email },
                  { label: isEn ? 'Field' : 'Obor', value: application.field_of_study },
                  { label: isEn ? 'Year' : 'Ročník', value: application.study_year },
                  { label: isEn ? 'Signed on' : 'V dne', value: application.signed_on },
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
                  {isEn ? 'Signatures' : 'Podpisy'}
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-stone-100 rounded-2xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
                      {isEn ? 'Applicant' : 'Žadatel'}
                    </div>
                    {(application.applicant_signature || application.signature_data_url) ? (
                      <Image
                        src={application.applicant_signature || application.signature_data_url}
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
                      {isEn ? 'President' : (dict?.admin?.chairwomanSignature || 'Podpis předsedy')}
                    </div>
                    {application.chairwoman_signature ? (
                      <Image
                        src={application.chairwoman_signature}
                        alt="President signature"
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
