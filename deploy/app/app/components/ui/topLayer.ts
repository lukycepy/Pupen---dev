'use client';

import React from 'react';

type TopLayerOptions = {
  closeOnEscape?: boolean;
  lockScroll?: boolean;
  initialFocus?: 'first' | 'container';
};

let stack: string[] = [];
let scrollLockCount = 0;
let savedScrollY = 0;

function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    savedScrollY = window.scrollY || 0;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (scrollLockCount <= 0) return;
  scrollLockCount -= 1;
  if (scrollLockCount === 0) {
    const body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    window.scrollTo(0, savedScrollY);
  }
}

function focusableElements(container: HTMLElement) {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return nodes.filter((el) => {
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
}

export function useTopLayer(
  open: boolean,
  onClose: () => void,
  containerRef: React.RefObject<HTMLElement | null>,
  options: TopLayerOptions = {},
) {
  const reactId = React.useId();
  const id = `tl_${String(reactId).replaceAll(':', '')}`;
  const activeElRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    activeElRef.current = (document.activeElement as HTMLElement) || null;
    stack = [...stack.filter((x) => x !== id), id];
    if (options.lockScroll !== false) lockBodyScroll();

    const el = containerRef.current;
    if (el) {
      const target =
        options.initialFocus === 'container'
          ? el
          : focusableElements(el)[0] || el;
      window.setTimeout(() => {
        try {
          target.focus();
        } catch {}
      }, 0);
    }

    return () => {
      stack = stack.filter((x) => x !== id);
      if (options.lockScroll !== false) unlockBodyScroll();
      const prev = activeElRef.current;
      if (prev) {
        window.setTimeout(() => {
          try {
            prev.focus();
          } catch {}
        }, 0);
      }
    };
  }, [open, containerRef, options.initialFocus, options.lockScroll, id]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isTop = stack[stack.length - 1] === id;
      if (!isTop) return;

      if (e.key === 'Escape' && options.closeOnEscape !== false) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const el = containerRef.current;
        if (!el) return;
        const focusables = focusableElements(el);
        if (!focusables.length) {
          e.preventDefault();
          return;
        }
        const current = document.activeElement as HTMLElement | null;
        const idx = current ? focusables.indexOf(current) : -1;
        const nextIdx = e.shiftKey ? (idx <= 0 ? focusables.length - 1 : idx - 1) : (idx === -1 || idx === focusables.length - 1 ? 0 : idx + 1);
        e.preventDefault();
        try {
          focusables[nextIdx].focus();
        } catch {}
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, containerRef, options.closeOnEscape, id]);
}
