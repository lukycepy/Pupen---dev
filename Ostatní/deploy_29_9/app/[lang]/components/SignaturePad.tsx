'use client';

import React, { useRef, useEffect, useState } from 'react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  width?: number;
  height?: number;
  clearLabel?: string;
}

function exportTrimmedDataUrl(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a !== 0) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return '';

  const padding = Math.round(Math.min(w, h) * 0.06);
  const sx = Math.max(0, minX - padding);
  const sy = Math.max(0, minY - padding);
  const sw = Math.min(w - sx, maxX - minX + padding * 2);
  const sh = Math.min(h - sy, maxY - minY + padding * 2);

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const octx = out.getContext('2d');
  if (!octx) return canvas.toDataURL('image/png');
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL('image/png');
}

export default function SignaturePad({ onSave, onClear, width = 560, height = 220, clearLabel = 'Smazat podpis' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const p = getPoint(e);
    if (!p) return;
    setIsDrawing(true);
    lastRef.current = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDrawing(false);
    lastRef.current = null;
    const dataUrl = exportTrimmedDataUrl(canvas);
    if (dataUrl) onSave(dataUrl);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const p = getPoint(e);
    if (!p) return;
    const last = lastRef.current;
    if (!last) {
      lastRef.current = p;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      return;
    }
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      onClear();
    }
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-stone-200 rounded-xl bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={startDrawing}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerMove={draw}
          className="cursor-crosshair w-full h-auto"
          style={{ touchAction: 'none' }}
        />
      </div>
      <button 
        type="button"
        onClick={clear}
        className="text-xs font-bold text-stone-400 hover:text-red-500 transition uppercase tracking-widest"
      >
        {clearLabel}
      </button>
    </div>
  );
}
