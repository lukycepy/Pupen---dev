'use client';

import React, { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { PUPEN_ANALYTICS_EVENT } from '@/lib/analytics-client';
import type { AnalyticsEventParams } from '@/lib/analytics-client';
import { readCookieConsent } from '@/lib/client-preferences';

type AnalyticsTrackEventDetail = {
  name?: unknown;
  params?: Record<string, unknown>;
};

type AnalyticsParamValue = AnalyticsEventParams[string];
const DEFAULT_GA_MEASUREMENT_ID = 'G-889DM5DL7F';

function isAnalyticsTrackEventDetail(value: unknown): value is AnalyticsTrackEventDetail {
  return typeof value === 'object' && value !== null;
}

function isAnalyticsParamValue(value: unknown): value is AnalyticsParamValue {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value);
}

function normalizeEventParams(input: Record<string, unknown>): AnalyticsEventParams {
  const output: AnalyticsEventParams = {};
  for (const [key, value] of Object.entries(input)) {
    if (isAnalyticsParamValue(value)) {
      output[key] = value;
    }
  }
  return output;
}

export default function SelfHostedAnalytics() {
  const pathname = usePathname() || '';
  const blocked = pathname.includes('/admin') || pathname.includes('/clen');

  const provider = String(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER || '').trim().toLowerCase();
  const src = String(process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL || '').trim();
  const gaMeasurementId = String(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID).trim();
  const [allowed, setAllowed] = useState(false);
  const isGa4 = provider === 'ga4' || !!gaMeasurementId;

  useEffect(() => {
    const sync = () => {
      setAllowed(readCookieConsent() === 'accepted');
    };
    sync();
    window.addEventListener('cookie-consent-changed', sync);
    return () => window.removeEventListener('cookie-consent-changed', sync);
  }, []);

  useEffect(() => {
    if (blocked || !allowed || !isGa4 || !gaMeasurementId) return;
    if (typeof window.gtag !== 'function') return;

    window.gtag('config', gaMeasurementId, {
      page_path: pathname,
      anonymize_ip: true,
    });
  }, [allowed, blocked, gaMeasurementId, isGa4, pathname]);

  useEffect(() => {
    if (blocked || !allowed) return;

    const onTrack = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (!isAnalyticsTrackEventDetail(event.detail)) return;

      const name = String(event.detail.name || '').trim();
      if (!name) return;

      const params =
        event.detail.params && typeof event.detail.params === 'object'
          ? normalizeEventParams(event.detail.params)
          : ({} as AnalyticsEventParams);

      if (isGa4 && typeof window.gtag === 'function') {
        window.gtag('event', name, params);
      }
      if (provider === 'plausible' && typeof window.plausible === 'function') {
        window.plausible(name, { props: params });
      }
      if (provider === 'umami' && typeof window.umami?.track === 'function') {
        window.umami.track(name, params);
      }
    };

    window.addEventListener(PUPEN_ANALYTICS_EVENT, onTrack);
    return () => window.removeEventListener(PUPEN_ANALYTICS_EVENT, onTrack);
  }, [allowed, blocked, isGa4, provider]);

  if (blocked) return null;
  if (!allowed) return null;

  if (isGa4 && gaMeasurementId) {
    return (
      <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`} strategy="afterInteractive" />
        <Script
          id="ga4-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}', { anonymize_ip: true });
            `,
          }}
        />
      </>
    );
  }

  if (!src) return null;

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
