'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import QrDesigner from '@/app/components/QrDesigner';

import { getDictionary } from '@/lib/get-dictionary';

export default function QrGeneratorPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();
  
  const [dict, setDict] = useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.qr);
    });
    return () => { isMounted = false; };
  }, [lang]);

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

        <QrDesigner
          title={dict.title}
          subtitle={dict.subtitle}
          onToast={(m, t) => showToast(m, t)}
        />
      </div>
    </div>
  );
}
