'use client';

import React from 'react';
import Portal from './Portal';
import { useTopLayer } from './topLayer';

export default function Dialog({
  open,
  onClose,
  children,
  closeOnBackdrop = true,
  overlayClassName = 'fixed inset-0 z-[30000] flex items-end sm:items-center justify-center p-0 sm:p-4 sm:pb-4 bg-black/60 backdrop-blur-sm',
  panelClassName = 'w-full sm:max-w-xl md:max-w-2xl bg-white rounded-t-3xl sm:rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-y-auto max-h-[92dvh] sm:max-h-[90vh]',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  overlayClassName?: string;
  panelClassName?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  useTopLayer(open, onClose, panelRef, { closeOnEscape: true, lockScroll: true, initialFocus: 'first' });
  if (!open) return null;

  return (
    <Portal>
      <div className={overlayClassName} onMouseDown={closeOnBackdrop ? onClose : undefined}>
        <div ref={panelRef} tabIndex={-1} className={panelClassName} onMouseDown={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </Portal>
  );
}
