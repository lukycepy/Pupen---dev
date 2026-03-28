'use client';

import React from 'react';
import Portal from './Portal';
import { useTopLayer } from './topLayer';

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
  const panelRef = React.useRef<HTMLDivElement>(null);
  useTopLayer(open, onClose, panelRef, { closeOnEscape: true, lockScroll: true, initialFocus: 'first' });

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={onClose}>
        <div
          ref={panelRef}
          tabIndex={-1}
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
