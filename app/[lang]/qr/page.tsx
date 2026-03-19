'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { QrCode, Download, RefreshCw, Link as LinkIcon, Globe } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import CopyButton from '@/app/components/CopyButton';

import { getDictionary } from '@/lib/get-dictionary';

export default function QrGeneratorPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();
  
  const [text, setText] = useState('https://pupen.org');
  const [qrUrl, setQrUrl] = useState('');
  const [color, setColor] = useState('#16a34a'); // green-600
  const [dict, setDict] = useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.qr);
    });
    return () => { isMounted = false; };
  }, [lang]);

  const generateQR = async () => {
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
      showToast(dict?.error || 'Něco se nepovedlo', 'error');
    }
  };

  // Generate initial QR
  React.useEffect(() => {
    if (dict) generateQR();
  }, [dict]);

  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `pupen-qr-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(dict?.success || 'QR kód stažen', 'success');
  };

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <QrCode size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-8 bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-stone-100">
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 flex items-center gap-2">
                  <LinkIcon size={12} /> {dict.labelUrl}
                </label>
                <div className="flex gap-3 items-stretch">
                  <input 
                    type="text" 
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    placeholder="https://..."
                  />
                  <CopyButton value={text} className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 flex items-center gap-2">
                  <Globe size={12} /> {dict.labelColor}
                </label>
                <div className="flex gap-4 mt-2">
                  {['#16a34a', '#000000', '#2563eb', '#dc2626', '#9333ea'].map(c => (
                    <button 
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-10 h-10 rounded-full border-4 transition ${color === c ? 'border-white ring-2 ring-stone-900' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input 
                    type="color" 
                    value={color} 
                    onChange={e => setColor(e.target.value)}
                    className="w-10 h-10 rounded-full overflow-hidden bg-transparent border-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={generateQR}
              className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-800 transition flex items-center justify-center gap-3 shadow-xl"
            >
              <RefreshCw size={20} /> {dict.btnGenerate}
            </button>
          </div>

          <div className="flex flex-col">
            <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-stone-100 flex-grow flex flex-col items-center justify-center text-center">
              <div className="mb-10 p-6 bg-stone-50 rounded-[2.5rem] border border-stone-100 shadow-inner group">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Code" className="w-64 h-64 md:w-80 md:h-80 transition group-hover:scale-105 duration-500" />
                ) : (
                  <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center text-stone-200">
                    <QrCode size={120} className="animate-pulse" />
                  </div>
                )}
              </div>

              <button 
                onClick={downloadQR}
                disabled={!qrUrl}
                className="w-full bg-green-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition flex items-center justify-center gap-3 shadow-xl shadow-green-900/20"
              >
                <Download size={24} /> {dict.btnDownload}
              </button>
              <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-stone-300">
                {dict.resolution}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
