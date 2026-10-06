'use client';

import { useEffect } from 'react';

export function ErrorReporter() {
  useEffect(() => {
    const maybeRecoverFromChunkError = async (message: string) => {
      const m = String(message || '');
      if (!/(ChunkLoadError|Loading chunk|CSS chunk)/i.test(m)) return false;
      try {
        if (window.sessionStorage.getItem('chunk-recover') === '1') return false;
        window.sessionStorage.setItem('chunk-recover', '1');
      } catch {}
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
      try {
        window.location.reload();
      } catch {}
      return true;
    };

    const handleError = (event: ErrorEvent) => {
      // Ignore ResizeObserver loop limit exceeded (harmless and common)
      if (event.message === 'ResizeObserver loop limit exceeded') return;
      maybeRecoverFromChunkError(event.message);

      fetch('/api/log/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: event.message,
          stack: event.error?.stack || null,
          url: window.location.href,
          user_agent: navigator.userAgent
        })
      }).catch(err => {
        // Silently fail if we can't report the error
        console.error('Failed to report error:', err);
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message || event.reason || 'Unhandled Promise Rejection');
      maybeRecoverFromChunkError(msg);
      fetch('/api/log/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: msg,
          stack: event.reason?.stack || null,
          url: window.location.href,
          user_agent: navigator.userAgent
        })
      }).catch(err => {
        console.error('Failed to report rejection:', err);
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
