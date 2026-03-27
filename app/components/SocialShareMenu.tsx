'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, Facebook, X as XIcon, Share2 } from 'lucide-react';
import CopyButton from './CopyButton';
import Portal from './ui/Portal';

function buildLinks(title: string, url: string) {
  const text = `${title}\n${url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  };
}

export default function SocialShareMenu({
  title,
  url,
  className = '',
}: {
  title: string;
  url?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');

  useEffect(() => {
    if (url) setResolvedUrl(url);
  }, [url]);

  const links = useMemo(() => {
    if (!resolvedUrl) return null;
    return buildLinks(title, resolvedUrl);
  }, [resolvedUrl, title]);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2.5 sm:p-3 bg-stone-50 text-stone-400 rounded-lg sm:rounded-xl hover:bg-green-50 hover:text-green-600 transition flex-1 sm:flex-none flex justify-center"
        aria-label="Sdílet"
      >
        <Share2 size={18} />
      </button>

      {open && (
        <>
          <Portal>
            <button
              type="button"
              className="fixed inset-0 z-[10000]"
              onClick={() => setOpen(false)}
              aria-label="Zavřít sdílení"
            />
          </Portal>
          <div className="absolute right-0 mt-3 z-[10001] w-64 bg-white border border-stone-100 shadow-2xl rounded-2xl p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">
              Sdílet
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={links?.whatsapp || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition px-3 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
              <a
                href={links?.telegram || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition px-3 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                <Send size={14} /> Telegram
              </a>
              <a
                href={links?.facebook || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition px-3 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                <Facebook size={14} /> Facebook
              </a>
              <a
                href={links?.x || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition px-3 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                <XIcon size={14} /> X
              </a>
            </div>
            <div className="mt-2">
              <CopyButton
                value={resolvedUrl}
                idleLabel="Kopírovat odkaz"
                copiedLabel="Zkopírováno"
                className="w-full border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
