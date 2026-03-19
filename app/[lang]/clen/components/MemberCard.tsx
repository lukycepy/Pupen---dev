'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { QrCode, Download } from 'lucide-react';
import CopyButton from '@/app/components/CopyButton';
import Image from 'next/image';

export default function MemberCard({
  lang,
  user,
  profile,
}: {
  lang: string;
  user: any;
  profile: any;
}) {
  const payload = useMemo(() => {
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    return JSON.stringify({
      v: 1,
      type: 'member',
      id: user?.id,
      email: user?.email,
      name: name || null,
    });
  }, [profile?.first_name, profile?.last_name, user?.email, user?.id]);

  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { default: QRCode } = await import('qrcode');
        const u = await QRCode.toDataURL(payload, { margin: 1, width: 640 });
        if (mounted) setQrUrl(u);
      } catch {
        if (mounted) setQrUrl('');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [payload]);

  const downloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `pupen-member-${user?.id || 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const title = lang === 'en' ? 'Member card' : 'Členská karta';

  return (
    <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
            <QrCode className="text-green-600" /> {title}
          </h2>
          <p className="text-stone-500 font-medium mt-2">
            {lang === 'en'
              ? 'Show this QR code when needed.'
              : 'Ukažte tento QR kód, když je potřeba rychlá identifikace.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CopyButton value={user?.id || ''} idleLabel={lang === 'en' ? 'Copy ID' : 'Kopírovat ID'} className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50" />
          <button
            type="button"
            onClick={downloadQr}
            disabled={!qrUrl}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
          >
            <Download size={16} />
            {lang === 'en' ? 'Download' : 'Stáhnout'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5">
          <div className="bg-stone-50 border border-stone-100 rounded-[2.5rem] p-8 flex items-center justify-center shadow-inner">
            {qrUrl ? (
              <Image
                src={qrUrl}
                alt="Member QR"
                width={256}
                height={256}
                unoptimized
                className="w-64 h-64 rounded-2xl bg-white p-4 border border-stone-100 shadow-sm"
              />
            ) : (
              <div className="w-64 h-64 rounded-2xl bg-white border border-stone-100 flex items-center justify-center text-stone-300 font-black uppercase tracking-widest text-xs">
                QR
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-stone-50 border border-stone-100 rounded-[2.5rem] p-8">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
              {lang === 'en' ? 'Member' : 'Člen'}
            </div>
            <div className="text-2xl font-black text-stone-900">
              {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email}
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="bg-white border border-stone-100 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Email</div>
                <div className="text-sm font-bold text-stone-700 truncate">{user?.email}</div>
              </div>
              <div className="bg-white border border-stone-100 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">ID</div>
                <div className="text-sm font-bold text-stone-700 truncate">{user?.id}</div>
              </div>
            </div>
            <div className="mt-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              {lang === 'en' ? 'This QR contains basic identification data.' : 'QR obsahuje základní identifikační údaje.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
