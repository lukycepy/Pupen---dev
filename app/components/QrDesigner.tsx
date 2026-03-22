'use client';

import React from 'react';
import { Download, Image as ImageIcon, RefreshCw } from 'lucide-react';

type PresetKey = 'pupen' | 'dark' | 'blue' | 'red' | 'purple';

type Props = {
  initialText?: string;
  initialCaption?: string;
  title?: string;
  subtitle?: string;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
};

const PRESETS: Record<PresetKey, { name: string; dark: string; light: string }> = {
  pupen: { name: 'Pupen', dark: '#16a34a', light: '#ffffff' },
  dark: { name: 'Černá', dark: '#000000', light: '#ffffff' },
  blue: { name: 'Modrá', dark: '#2563eb', light: '#ffffff' },
  red: { name: 'Červená', dark: '#dc2626', light: '#ffffff' },
  purple: { name: 'Fialová', dark: '#9333ea', light: '#ffffff' },
};

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export default function QrDesigner({ initialText, initialCaption, title, subtitle, onToast }: Props) {
  const [text, setText] = React.useState(initialText || 'https://pupen.org');
  const [caption, setCaption] = React.useState(initialCaption || '');
  const [showCaption, setShowCaption] = React.useState(false);
  const [preset, setPreset] = React.useState<PresetKey>('pupen');
  const [dark, setDark] = React.useState(PRESETS.pupen.dark);
  const [light, setLight] = React.useState(PRESETS.pupen.light);
  const [margin, setMargin] = React.useState(2);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoUrl, setLogoUrl] = React.useState<string>('');
  const [pngUrl, setPngUrl] = React.useState<string>('');
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    const p = PRESETS[preset];
    setDark(p.dark);
    setLight(p.light);
  }, [preset]);

  React.useEffect(() => {
    if (!logoFile) {
      setLogoUrl('');
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const generatePng = React.useCallback(async () => {
    const value = String(text || '').trim();
    if (!value) {
      onToast?.('Zadej text/URL', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const { default: QRCode } = await import('qrcode');

      const qrSize = 1000;
      const captionHeight = showCaption && caption.trim() ? 140 : 0;
      const canvas = document.createElement('canvas');
      canvas.width = qrSize;
      canvas.height = qrSize + captionHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      ctx.fillStyle = light;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const qrCanvas = document.createElement('canvas');
      qrCanvas.width = qrSize;
      qrCanvas.height = qrSize;

      const ecl = logoUrl ? 'H' : 'M';
      await QRCode.toCanvas(qrCanvas, value, {
        width: qrSize,
        margin,
        errorCorrectionLevel: ecl,
        color: { dark, light },
      });

      ctx.drawImage(qrCanvas, 0, 0);

      if (logoUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Logo load failed'));
          img.src = logoUrl;
        });

        const logoSize = Math.round(qrSize * 0.22);
        const pad = Math.round(qrSize * 0.03);
        const x = Math.round((qrSize - logoSize) / 2);
        const y = Math.round((qrSize - logoSize) / 2);
        ctx.save();
        drawRoundRect(ctx, x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, Math.round(pad * 0.9));
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
        ctx.drawImage(img, x, y, logoSize, logoSize);
      }

      if (captionHeight) {
        ctx.save();
        ctx.fillStyle = '#0c0a09';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxWidth = qrSize - 140;
        const line1 = caption.trim();
        ctx.font = '800 44px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
        let textToDraw = line1;
        while (ctx.measureText(textToDraw).width > maxWidth && textToDraw.length > 3) {
          textToDraw = `${textToDraw.slice(0, -4)}…`;
        }
        ctx.fillText(textToDraw, qrSize / 2, qrSize + captionHeight / 2);
        ctx.restore();
      }

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      setPngUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e: any) {
      onToast?.(e?.message || 'Chyba generování QR', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [caption, dark, light, logoUrl, margin, onToast, showCaption, text]);

  React.useEffect(() => {
    generatePng();
  }, []);

  const downloadPng = () => {
    if (!pngUrl) return;
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `pupen-qr-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onToast?.('QR kód stažen', 'success');
  };

  const downloadSvg = async () => {
    if (logoUrl || (showCaption && caption.trim())) {
      onToast?.('SVG export je dostupný jen bez loga a popisku', 'info');
      return;
    }
    try {
      const { default: QRCode } = await import('qrcode');
      const svg = await QRCode.toString(String(text || '').trim(), {
        type: 'svg',
        margin,
        errorCorrectionLevel: 'M',
        color: { dark, light },
      });
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pupen-qr-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast?.('SVG staženo', 'success');
    } catch (e: any) {
      onToast?.(e?.message || 'Chyba exportu SVG', 'error');
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-10">
      <div className="space-y-8 bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-stone-100">
        {(title || subtitle) && (
          <div>
            {title && <div className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">{title}</div>}
            {subtitle && <div className="text-stone-500 font-medium mt-1">{subtitle}</div>}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Text / URL</div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-2 w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              placeholder="https://..."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Styl</div>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as PresetKey)}
                className="mt-2 w-full bg-stone-50 border-none rounded-2xl px-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              >
                {Object.entries(PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Okraj (tichá zóna)</div>
              <input
                type="number"
                value={margin}
                min={1}
                max={8}
                onChange={(e) => setMargin(Number(e.target.value) || 2)}
                className="mt-2 w-full bg-stone-50 border-none rounded-2xl px-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Barva QR</div>
              <div className="mt-2 flex items-center gap-3">
                <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="w-10 h-10 rounded-xl" />
                <input
                  value={dark}
                  onChange={(e) => setDark(e.target.value)}
                  className="flex-1 bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Pozadí</div>
              <div className="mt-2 flex items-center gap-3">
                <input type="color" value={light} onChange={(e) => setLight(e.target.value)} className="w-10 h-10 rounded-xl" />
                <input
                  value={light}
                  onChange={(e) => setLight(e.target.value)}
                  className="flex-1 bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Logo uprostřed (volitelné)</div>
              <div className="mt-2 relative border-2 border-dashed border-stone-200 rounded-2xl p-5 hover:border-green-400 hover:bg-green-50/30 transition">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-stone-400">
                    <ImageIcon size={18} />
                  </div>
                  <div className="text-sm font-bold text-stone-700 truncate">
                    {logoFile ? logoFile.name : 'Klikni pro výběr'}
                  </div>
                </div>
              </div>
              {logoFile && (
                <button
                  type="button"
                  onClick={() => setLogoFile(null)}
                  className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-red-600 transition"
                >
                  Odebrat logo
                </button>
              )}
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Text pod QR (volitelné)</div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCaption((v) => !v)}
                  className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                    showCaption ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {showCaption ? 'Zapnuto' : 'Vypnuto'}
                </button>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={!showCaption}
                  className="flex-1 bg-stone-50 border-none rounded-2xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none disabled:opacity-50"
                  placeholder="Např. Pupen — kontakt"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={generatePng}
          disabled={isGenerating}
          className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-800 transition flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
        >
          <RefreshCw size={20} /> Generovat
        </button>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-stone-100 flex flex-col items-center justify-center text-center">
        <div className="mb-8 p-6 bg-stone-50 rounded-[2.5rem] border border-stone-100 shadow-inner">
          {pngUrl ? (
            <img src={pngUrl} alt="QR" className="w-64 h-64 md:w-80 md:h-80" />
          ) : (
            <div className="w-64 h-64 md:w-80 md:h-80 bg-white rounded-3xl border border-stone-100" />
          )}
        </div>

        <div className="w-full grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={downloadPng}
            disabled={!pngUrl}
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition flex items-center justify-center gap-3 shadow-xl shadow-green-900/20"
          >
            <Download size={18} /> PNG
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            className="w-full bg-white text-stone-700 py-4 rounded-2xl font-black uppercase tracking-widest border border-stone-200 hover:bg-stone-50 transition flex items-center justify-center gap-3"
          >
            <Download size={18} /> SVG
          </button>
        </div>

        <div className="mt-6 text-[10px] font-black uppercase tracking-widest text-stone-300">
          {logoUrl ? 'Logo vyžaduje error correction H' : 'Bez loga stačí error correction M'}
        </div>
      </div>
    </div>
  );
}

