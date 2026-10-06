'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, Facebook, X as XIcon, Share2 } from 'lucide-react';
import CopyButton from './CopyButton';
import Popover from './ui/Popover';

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
  const anchorRef = React.useRef<HTMLButtonElement>(null);

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
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2.5 sm:p-3 bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white rounded-lg sm:rounded-xl hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400 transition flex-1 sm:flex-none flex justify-center"
        aria-label="Sdílet"
      >
        <Share2 size={18} />
      </button>

      {open && (
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
          placement="bottom-end"
          offset={12}
          zIndex={10001}
          panelClassName="w-64 bg-white dark:bg-black border-2 border-black dark:border-white rounded-2xl p-3"
        >
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 px-1 mb-2">
              Sdílet
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={links?.whatsapp || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400 hover:border-green-600 dark:hover:border-green-400 transition px-3 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
              <a
                href={links?.telegram || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400 hover:border-green-600 dark:hover:border-green-400 transition px-3 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                <Send size={14} /> Telegram
              </a>
              <a
                href={links?.facebook || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400 hover:border-green-600 dark:hover:border-green-400 transition px-3 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                <Facebook size={14} /> Facebook
              </a>
              <a
                href={links?.x || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400 hover:border-green-600 dark:hover:border-green-400 transition px-3 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                <XIcon size={14} /> X
              </a>
            </div>
            <div className="mt-2">
              <CopyButton
                value={resolvedUrl}
                idleLabel="Kopírovat odkaz"
                copiedLabel="Zkopírováno"
                className="w-full border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400"
              />
            </div>
        </Popover>
      )}
    </div>
  );
}
