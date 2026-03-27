'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

export default function SelfHostedAnalytics() {
  const pathname = usePathname() || '';
  if (pathname.includes('/admin') || pathname.includes('/clen')) return null;

  const provider = String(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER || '').trim().toLowerCase();
  const src = String(process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL || '').trim();
  const [allowed, setAllowed] = useState(false);

  const consent = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      return String(window.localStorage.getItem('cookie-consent') || '');
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      try {
        setAllowed(String(window.localStorage.getItem('cookie-consent') || '') === 'accepted');
      } catch {
        setAllowed(false);
      }
    };
    sync();
    window.addEventListener('cookie-consent-changed', sync as any);
    return () => window.removeEventListener('cookie-consent-changed', sync as any);
  }, [consent]);

  if (!src) return null;
  if (!allowed) return null;

  if (provider === 'plausible') {
    const domain = String(process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN || '').trim();
    if (!domain) return null;
    return <Script src={src} strategy="afterInteractive" data-domain={domain} defer />;
  }

  if (provider === 'umami') {
    const websiteId = String(process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID || '').trim();
    if (!websiteId) return null;
    return <Script src={src} strategy="afterInteractive" data-website-id={websiteId} defer />;
  }

  return <Script src={src} strategy="afterInteractive" defer />;
}
