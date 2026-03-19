'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { QrCode, Download, Link as LinkIcon, Globe } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/app/context/ToastContext';
import Skeleton from '@/app/[lang]/components/Skeleton';

export default function QRTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [text, setText] = useState('https://pupen.org');
  const [qrUrl, setQrUrl] = useState('');
  const [color, setColor] = useState('#16a34a'); // green-600
  const [isGenerating, setIsGenerating] = useState(false);

  const generateQR = useCallback(async () => {
    setIsGenerating(true);
    try {
      const { default: QRCode } = await import('qrcode');
      const url = await QRCode.toDataURL(text, {
        width: 1000,
        margin: 2,
        color: {
          dark: color,
          light: '#ffffff'
        }
      });
      setQrUrl(url);
    } catch (err) {
      console.error(err);
      showToast(dict.contactPage.errorText, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [color, dict.contactPage.errorText, showToast, text]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  const downloadQR = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `pupen-qr-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(dict.qr.download.includes('Stáhnout') ? 'QR kód byl stažen' : 'QR code downloaded', 'success');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-stone-900 flex items-center gap-3">
            <QrCode className="text-green-600" />
            {dict.qr.title}
          </h2>
          <p className="text-stone-500 font-medium">{dict.qr.subtitle}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">
                <LinkIcon size={12} className="inline mr-1" /> {dict.qr.labelUrl}
              </label>
              <input 
                type="text" 
                value={text} 
                onChange={e => setText(e.target.value)} 
                className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2 block">
                <Globe size={12} className="inline mr-1" /> {dict.admin.tabMessages.includes('Zprávy') ? 'Barva kódu' : 'Code color'}
              </label>
              <div className="flex flex-wrap gap-3">
                {['#16a34a', '#000000', '#2563eb', '#dc2626', '#9333ea'].map(c => (
                  <button 
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-10 h-10 rounded-full border-4 transition ${color === c ? 'border-white ring-2 ring-green-600' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-stone-200">
                  <input 
                    type="color" 
                    value={color} 
                    onChange={e => setColor(e.target.value)}
                    className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-50">
            <button 
              onClick={downloadQR}
              disabled={!qrUrl || isGenerating}
              className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-800 transition shadow-xl disabled:opacity-50"
            >
              <Download size={20} />
              {dict.qr.download} (PNG)
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center justify-center min-h-[400px]">
          <div className="relative p-6 bg-white rounded-3xl border-4 border-stone-50 shadow-inner group">
            {isGenerating ? (
              <div className="w-64 h-64 flex items-center justify-center">
                <Skeleton className="w-64 h-64 rounded-xl" />
              </div>
            ) : qrUrl ? (
              <Image
                src={qrUrl}
                alt="QR Code Preview"
                width={256}
                height={256}
                className="w-64 h-64 rounded-xl shadow-sm"
                unoptimized
              />
            ) : (
              <div className="w-64 h-64 bg-stone-50 rounded-xl flex items-center justify-center text-stone-300">
                <QrCode size={64} />
              </div>
            )}
          </div>
          <p className="mt-6 text-sm font-bold text-stone-400 uppercase tracking-widest">{dict.admin.tabMessages.includes('Zprávy') ? 'Náhled kódu' : 'Preview'}</p>
        </div>
      </div>
    </div>
  );
}
