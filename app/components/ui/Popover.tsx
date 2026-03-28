'use client';

import React from 'react';
import Portal from './Portal';
import { useTopLayer } from './topLayer';

type Placement = 'bottom-start' | 'bottom-end' | 'bottom-center' | 'top-start' | 'top-end' | 'top-center';

export default function Popover({
  open,
  onClose,
  anchorRef,
  children,
  placement = 'bottom-start',
  offset = 8,
  matchWidth = false,
  zIndex = 10001,
  panelClassName = 'bg-white border border-stone-100 shadow-2xl rounded-2xl',
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  placement?: Placement;
  offset?: number;
  matchWidth?: boolean;
  zIndex?: number;
  panelClassName?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  useTopLayer(open, onClose, panelRef, { closeOnEscape: true, lockScroll: false, initialFocus: 'first' });

  const [pos, setPos] = React.useState<{ top: number; left: number; width?: number; maxHeight?: number }>({ top: -9999, left: -9999 });

  const updatePosition = React.useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = panel.offsetWidth || 0;
    const ph = panel.offsetHeight || 0;

    const baseWidth = matchWidth ? Math.round(a.width) : undefined;

    const computeTop = (dir: 'bottom' | 'top') => (dir === 'bottom' ? Math.round(a.bottom + offset) : Math.round(a.top - offset - ph));
    const computeLeft = (align: 'start' | 'end' | 'center') => {
      if (align === 'start') return Math.round(a.left);
      if (align === 'end') return Math.round(a.right - (baseWidth ?? pw));
      const center = a.left + a.width / 2;
      return Math.round(center - (baseWidth ?? pw) / 2);
    };

    const dir = placement.startsWith('top') ? 'top' : 'bottom';
    const align = placement.endsWith('end') ? 'end' : placement.endsWith('center') ? 'center' : 'start';

    let top = computeTop(dir as any);
    let left = computeLeft(align as any);

    const w = baseWidth ?? pw;
    const h = ph;

    const minLeft = 8;
    const maxLeft = vw - w - 8;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    const roomBelow = vh - (a.bottom + offset) - 8;
    const roomAbove = a.top - offset - 8;
    const wantBottom = dir === 'bottom';
    const fitsBottom = h <= roomBelow;
    const fitsTop = h <= roomAbove;

    if (wantBottom && !fitsBottom && fitsTop) top = computeTop('top');
    if (!wantBottom && !fitsTop && fitsBottom) top = computeTop('bottom');

    const maxHeight = wantBottom ? Math.max(120, roomBelow) : Math.max(120, roomAbove);
    const boundedTop = Math.max(8, Math.min(vh - 8 - 40, top));

    setPos({ top: boundedTop, left, width: baseWidth, maxHeight });
  }, [anchorRef, matchWidth, offset, placement]);

  React.useLayoutEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => updatePosition());
    return () => window.cancelAnimationFrame(raf);
  }, [open, updatePosition, children]);

  React.useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!t || !panel) return;
      if (panel.contains(t)) return;
      if (anchor && anchor.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <Portal>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={panelClassName}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
          overflow: 'auto',
          zIndex,
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

