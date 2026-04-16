'use client';

import React from 'react';
import { QrCode } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import QrDesigner from '@/app/components/QrDesigner';

export default function QRTab({ dict }: { dict: any }) {
  const { showToast } = useToast();

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

      <QrDesigner onToast={(m, t) => showToast(m, t)} />
    </div>
  );
}
