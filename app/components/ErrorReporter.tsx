'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ErrorReporter() {
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

    const handleError = async (event: ErrorEvent) => {
      try {
        maybeRecoverFromChunkError(event.message);
        await supabase.from('error_logs').insert([{
          message: event.message,
          stack: event.error?.stack,
          url: window.location.href,
          user_agent: navigator.userAgent
        }]);
      } catch (err) {
        console.error('Failed to report error:', err);
      }
    };

    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      try {
        const msg = String(event.reason?.message || event.reason || 'Unhandled Promise Rejection');
        maybeRecoverFromChunkError(msg);
        await supabase.from('error_logs').insert([{
          message: `Unhandled Rejection: ${msg}`,
          url: window.location.href,
          user_agent: navigator.userAgent
        }]);
      } catch (err) {
        console.error('Failed to report rejection:', err);
      }
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
