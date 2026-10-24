import React from 'react';
import { Instagram } from 'lucide-react';
import Image from 'next/image';
import type { InstagramFeedPost } from '@/lib/site/instagram-feed';

export default function InstagramFeedGrid({ url, handle, posts = [] }: { url?: string; handle?: string; posts?: InstagramFeedPost[] }) {
  const href = url || 'https://instagram.com/pupenfappz/';
  const label = handle || '@pupenfappz';
  const tiles = posts.filter((post) => post?.href && post?.image_url).slice(0, 6);
  return (
    <section className="py-20 px-6 max-w-6xl mx-auto bg-white dark:bg-black">
      <div className="flex items-end justify-between gap-6 mb-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 dark:text-stone-500 mb-3">Instagram</div>
          <h2 className="text-3xl md:text-5xl font-black text-black dark:text-white tracking-tight">Pupen v obrazech</h2>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-bold hover:bg-green-600 dark:hover:bg-green-500 hover:text-white dark:hover:text-white transition border-2 border-black dark:border-white hover:border-green-600 dark:hover:border-green-500"
        >
          <Instagram size={18} />
          {label}
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.length > 0 ? tiles.map((post, i) => (
          <a
            key={`${post.href}-${i}`}
            href={post.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square rounded-[2rem] bg-white dark:bg-black border-2 border-black dark:border-white overflow-hidden transition"
          >
            <Image
              src={`/api/image-proxy?url=${encodeURIComponent(post.image_url)}`}
              alt={post.alt || 'Instagram'}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-70 transition group-hover:opacity-90" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 text-white">
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <Instagram size={16} />
                Otevřít
              </div>
            </div>
          </a>
        )) : Array.from({ length: 6 }, (_, i) => (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square rounded-[2rem] bg-white dark:bg-black border-2 border-black dark:border-white overflow-hidden transition"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(22,163,74,0.12)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-green-50/50 dark:bg-green-950/30" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-300 dark:text-stone-600 group-hover:text-green-600 dark:group-hover:text-green-400 transition">
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
          className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-bold hover:bg-green-600 dark:hover:bg-green-500 hover:text-white dark:hover:text-white transition border-2 border-black dark:border-white hover:border-green-600 dark:hover:border-green-500"
        >
          <Instagram size={18} />
          {label}
        </a>
      </div>
    </section>
  );
}
