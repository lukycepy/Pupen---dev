import React from 'react';
import { Instagram } from 'lucide-react';

export default function InstagramFeedGrid({ url, handle }: { url?: string; handle?: string }) {
  const href = url || 'https://instagram.com/pupenfappz/';
  const label = handle || '@pupenfappz';
  const tiles = Array.from({ length: 6 }, (_, i) => i);
  return (
    <section className="py-20 px-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-6 mb-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-3">Instagram</div>
          <h2 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight">Pupen v obrazech</h2>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg"
        >
          <Instagram size={18} />
          {label}
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.map((i) => (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square rounded-[2rem] bg-white border border-stone-100 shadow-sm overflow-hidden hover:shadow-xl transition"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(22,163,74,0.12)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-stone-50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-300 group-hover:text-green-600 transition">
              <Instagram size={28} />
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest">Otevřít</div>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-8 sm:hidden">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg"
        >
          <Instagram size={18} />
          {label}
        </a>
      </div>
    </section>
  );
}
