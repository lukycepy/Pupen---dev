'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';

export default function NotFound() {
  const pathname = usePathname();
  const [dict, setDict] = useState<any>(null);
  const [clicks, setClicks] = useState(0);
  const [showGame, setShowGame] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  
  // Detekce jazyka z URL (předpokládá /cs/... nebo /en/...)
  const lang = pathname?.split('/')[1] === 'en' ? 'en' : 'cs';

  useEffect(() => {
    async function loadData() {
      const dictionary = await getDictionary(lang);
      setDict(dictionary.notFound);
    }
    loadData();
  }, [lang]);

  const gameText = useMemo(() => {
    if (lang === 'en') {
      return {
        hint: 'Hint: click the logo 7×',
        title: 'Tractor Run',
        start: 'Press Space to jump',
        close: 'Close',
      };
    }
    return {
      hint: 'Tip: klikni na logo 7×',
      title: 'Traktor Run',
      start: 'Skok: mezerník',
      close: 'Zavřít',
    };
  }, [lang]);

  useEffect(() => {
    if (!showGame) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = 520;
    const h = 180;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    let running = true;
    let y = 0;
    let vy = 0;
    let score = 0;
    let speed = 3.2;
    const groundY = h - 36;
    const obstacles: { x: number; w: number; h: number }[] = [];
    let nextObstacleAt = 40;

    const spawn = () => {
      const ow = 10 + Math.random() * 18;
      const oh = 14 + Math.random() * 26;
      obstacles.push({ x: w + 20, w: ow, h: oh });
      nextObstacleAt = 35 + Math.random() * 45;
    };

    const reset = () => {
      y = 0;
      vy = 0;
      score = 0;
      speed = 3.2;
      obstacles.length = 0;
      nextObstacleAt = 40;
      running = true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (!running) {
        reset();
        return;
      }
      if (y === 0) vy = 9.5;
    };
    window.addEventListener('keydown', onKeyDown);

    const loop = () => {
      rafRef.current = window.requestAnimationFrame(loop);
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(22,163,74,0.12)';
      ctx.beginPath();
      ctx.arc(w - 50, 30, 80, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, groundY, w, 2);

      ctx.fillStyle = '#e7e5e4';
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(`${gameText.title} • ${gameText.start} • ${Math.floor(score)}`, 14, 18);

      if (running) {
        score += 0.08 * speed;
        speed = Math.min(7, speed + 0.0006);

        if (vy !== 0 || y !== 0) {
          y = Math.max(0, y + vy);
          vy = vy - 0.55;
          if (y === 0) vy = 0;
        }

        nextObstacleAt -= 1;
        if (nextObstacleAt <= 0) spawn();

        for (const ob of obstacles) ob.x -= speed;
        while (obstacles.length && obstacles[0].x + obstacles[0].w < -10) obstacles.shift();
      }

      const tx = 70;
      const ty = groundY - 18 - y;
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(tx, ty, 26, 18);
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(tx + 4, ty + 5, 6, 6);
      ctx.fillStyle = '#e7e5e4';
      ctx.fillText('🚜', tx - 2, ty + 16);

      ctx.fillStyle = '#ef4444';
      for (const ob of obstacles) {
        const ox = ob.x;
        const oy = groundY - ob.h;
        ctx.fillRect(ox, oy, ob.w, ob.h);
        const hit =
          running &&
          tx + 20 > ox &&
          tx < ox + ob.w &&
          ty + 16 > oy &&
          ty < oy + ob.h;
        if (hit) running = false;
      }

      if (!running) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText(lang === 'en' ? 'Game over — press Space to retry' : 'Konec — mezerník pro restart', 110, 98);
      }
    };

    loop();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [lang, gameText.title, gameText.start, showGame]);

  if (!dict) return (
    <div className="min-h-screen flex items-center justify-center bg-white text-black dark:bg-black dark:text-white font-bold uppercase tracking-widest text-sm">
      404 - Page Not Found
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white font-sans flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">

        {/* Karta ve stylu kontaktní stránky */}
        <div className="bg-white dark:bg-black p-8 md:p-20 rounded-[3rem] text-center border-2 border-black dark:border-white">

          {/* Logo Pupen (zmenšené) */}
          <div className="mb-10 flex justify-center">
            <Link
              href={`/${lang}`}
              onClick={(e) => {
                const n = clicks + 1;
                setClicks(n);
                if (n >= 7) {
                  e.preventDefault();
                  setShowGame(true);
                  setClicks(0);
                }
              }}
              className="transition-transform hover:scale-105 duration-300"
            >
              <NextImage 
                src="/logo.png" 
                alt="Logo Spolek Pupen" 
                width={56}
                height={56}
                className="rounded-full object-cover border-2 border-black dark:border-white"
              />
            </Link>
          </div>

          <div className="text-[10px] font-black uppercase tracking-[0.2em]">{gameText.hint}</div>

          {/* Obsah */}
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <span className="font-black uppercase tracking-[0.3em] text-[10px] mb-4 px-3 py-1 border-2 border-black dark:border-white rounded-full">
                Error 404
              </span>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-4">
                {dict.title}
              </h1>
            </div>
            
            <p className="text-lg md:text-xl font-medium leading-relaxed max-w-md mx-auto">
              {dict.description}
            </p>

            {/* Tlačítko - stejné jako na webu */}
            <div className="pt-8 flex justify-center">
              <Link 
                href={`/${lang}`} 
                className="bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white px-8 py-4 rounded-xl font-bold transition-all hover:bg-green-600 hover:text-white hover:border-green-600 dark:hover:bg-green-500 dark:hover:text-black dark:hover:border-green-500 flex items-center gap-3 active:scale-95"
              >
                <ArrowLeft size={20} />
                {dict.backBtn}
              </Link>
            </div>
          </div>
        </div>

        {/* Spodní info */}
        <p className="mt-12 text-center text-[11px] font-black uppercase tracking-[0.2em]">
          Studentský spolek Pupen, z.s. &bull; {new Date().getFullYear()}
        </p>
      </div>

      {showGame ? (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-xl bg-white dark:bg-black rounded-[2.5rem] border-2 border-black dark:border-white p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="font-black text-xl">{gameText.title}</div>
              <button
                type="button"
                onClick={() => setShowGame(false)}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 transition"
              >
                {gameText.close}
              </button>
            </div>
            <div className="flex justify-center">
              <canvas ref={canvasRef} className="rounded-2xl border-2 border-black dark:border-white" />
            </div>
            <div className="font-medium text-sm mt-5">{gameText.start}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
