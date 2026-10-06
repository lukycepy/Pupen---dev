'use client';

import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface TicketDisplayProps {
  token: string;
  eventName: string;
  userName: string;
}

export default function TicketDisplay({ token, eventName, userName }: TicketDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, token, {
        width: 256,
        margin: 2,
        color: {
          dark: '#16a34a', // Green-600
          light: '#ffffff',
        },
      }, (error) => {
        if (error) console.error('QR Code error:', error);
      });
    }
  }, [token]);

  return (
    <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-stone-100 max-w-sm mx-auto text-center space-y-6 animate-in zoom-in duration-500">
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-green-600">Oficiální Vstupenka</p>
        <h3 className="text-2xl font-black text-stone-900 leading-tight">{eventName}</h3>
      </div>
      
      <div className="relative p-4 bg-stone-50 rounded-[2rem] shadow-inner border border-stone-100 inline-block">
        <canvas ref={canvasRef} className="rounded-xl" />
        <div className="absolute inset-0 border-4 border-white/50 rounded-[2rem] pointer-events-none" />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Držitel</p>
        <p className="text-lg font-bold text-stone-800">{userName}</p>
        <code className="text-[10px] text-stone-300 font-mono uppercase">{token}</code>
      </div>

      <div className="pt-6 border-t border-dashed border-stone-200">
        <p className="text-[10px] text-stone-400 font-medium italic">
          Při vstupu ukažte tento QR kód administrátorovi k odbavení.
        </p>
      </div>
    </div>
  );
}
