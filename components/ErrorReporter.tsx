'use client';

import { useEffect } from 'react';

export function ErrorReporter() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Ignore ResizeObserver loop limit exceeded (harmless and common)
      if (event.message === 'ResizeObserver loop limit exceeded') return;

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
      fetch('/api/log/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: event.reason?.message || 'Unhandled Promise Rejection',
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
