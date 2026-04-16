'use client';

import React from 'react';
import Portal from './Portal';
import { useTopLayer } from './topLayer';

export default function Drawer({
  open,
  onClose,
  children,
  side = 'left',
  closeOnBackdrop = true,
  overlayClassName = 'fixed inset-0 z-[10000] flex',
  backdropClassName = 'absolute inset-0 bg-black/60 backdrop-blur-sm',
  panelClassName = 'relative h-full w-72 bg-white',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'top' | 'bottom';
  closeOnBackdrop?: boolean;
  overlayClassName?: string;
  backdropClassName?: string;
  panelClassName?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  useTopLayer(open, onClose, panelRef, { closeOnEscape: true, lockScroll: true, initialFocus: 'first' });
  if (!open) return null;

  const sideAlign =
    side === 'left'
      ? 'items-stretch justify-start'
      : side === 'right'
        ? 'items-stretch justify-end'
        : side === 'top'
          ? 'items-start justify-stretch'
          : 'items-end justify-stretch';

  return (
    <Portal>
      <div className={`${overlayClassName} ${sideAlign}`}>
        <button type="button" className={backdropClassName} onClick={closeOnBackdrop ? onClose : undefined} aria-label="Zavřít" />
        <div ref={panelRef} tabIndex={-1} className={panelClassName} onMouseDown={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </Portal>
  );
}

