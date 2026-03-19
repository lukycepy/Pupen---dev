'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, Facebook, X as XIcon, Link as LinkIcon } from 'lucide-react';
import CopyButton from './CopyButton';

function buildLinks(title: string, url: string) {
  const text = `${title}\n${url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  };
}

export default function SocialShareInline({ title }: { title: string }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const links = useMemo(() => {
    if (!url) return null;
    return buildLinks(title, url);
  }, [title, url]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Sdílet</div>
      <div className="flex flex-wrap gap-2">
        <a
          href={links?.whatsapp || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
        >
          <MessageCircle size={14} /> WhatsApp
        </a>
        <a
          href={links?.telegram || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
        >
          <Send size={14} /> Telegram
        </a>
        <a
          href={links?.facebook || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
        >
          <Facebook size={14} /> Facebook
        </a>
        <a
          href={links?.x || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
        >
          <XIcon size={14} /> X
        </a>
        <div className="hidden sm:block w-px bg-stone-200 mx-1" />
        <CopyButton
          value={url}
          idleLabel="Kopírovat"
          copiedLabel="Zkopírováno"
          className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
        />
        <a
          href={url || '#'}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
        >
          <LinkIcon size={14} /> Odkaz
        </a>
      </div>
    </div>
  );
}
