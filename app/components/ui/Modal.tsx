'use client';

import React, { useEffect } from 'react';
import Portal from './Portal';

export default function Modal({
  open,
  onClose,
  children,
  maxWidthClassName = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={onClose}>
        <div
          className={['bg-white rounded-[2rem] p-6 w-full shadow-2xl relative', maxWidthClassName].join(' ')}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-5 right-5 text-stone-400 hover:text-stone-900">
            ✕
          </button>
          {children}
        </div>
      </div>
    </Portal>
  );
}
