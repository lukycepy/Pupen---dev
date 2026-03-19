'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ErrorReporter() {
  useEffect(() => {
    const handleError = async (event: ErrorEvent) => {
      try {
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
        await supabase.from('error_logs').insert([{
          message: `Unhandled Rejection: ${event.reason}`,
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
