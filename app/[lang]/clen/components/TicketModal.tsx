'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import CopyButton from '@/app/components/CopyButton';
import Image from 'next/image';
import Dialog from '@/app/components/ui/Dialog';

export default function TicketModal({
  open,
  onClose,
  lang,
  title,
  qrToken,
  status,
  expiresAt,
}: {
  open: boolean;
  onClose: () => void;
  lang: string;
  title: string;
  qrToken: string;
  status: string | null;
  expiresAt: string | null;
}) {
  const statusLabel = useMemo(() => {
    const s = String(status || '').trim();
    if (lang === 'en') {
      if (s === 'confirmed') return 'Confirmed';
      if (s === 'reserved') return 'Reserved';
      if (s === 'waitlist') return 'Waitlist';
      if (s === 'cancelled') return 'Cancelled';
      return s || '—';
    }
    if (s === 'confirmed') return 'Potvrzeno';
    if (s === 'reserved') return 'Rezervováno';
    if (s === 'waitlist') return 'Čekací listina';
    if (s === 'cancelled') return 'Zrušeno';
    return s || '—';
  }, [lang, status]);

  const payload = useMemo(() => `PUPEN-TICKET:${qrToken}`, [qrToken]);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (!open) return;
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
  }, [open, payload]);

  if (!open) return null;

  const downloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `pupen-ticket-${String(qrToken || '').slice(0, 32)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      overlayClassName="fixed inset-0 z-[10002] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      panelClassName="relative w-full max-w-lg bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden"
    >
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                {lang === 'en' ? 'Ticket' : 'Vstupenka'}
              </div>
              <div className="font-black text-stone-900 truncate">{title}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400"
              aria-label="Zavřít"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 flex items-center justify-center shadow-inner">
              {qrUrl ? (
                <Image
                  src={qrUrl}
                  alt="Ticket QR"
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

            <div className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Token</div>
                  <div className="font-black tracking-widest text-stone-900">{qrToken}</div>
                </div>
                <CopyButton
                  value={qrToken}
                  className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  idleLabel={lang === 'en' ? 'Copy' : 'Kopírovat'}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-stone-400">
                <span>
                  {lang === 'en' ? 'Status' : 'Stav'}: {statusLabel}
                </span>
                {expiresAt ? (
                  <span>
                    {lang === 'en' ? 'Valid until' : 'Platí do'}:{' '}
                    {new Date(expiresAt).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                  </span>
                ) : (
                  <span />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={downloadQr}
                disabled={!qrUrl}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
              >
                <Download size={16} />
                {lang === 'en' ? 'Download' : 'Stáhnout'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
              >
                {lang === 'en' ? 'Done' : 'Hotovo'}
              </button>
            </div>
          </div>
    </Dialog>
  );
}
