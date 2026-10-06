'use client';

export const PUPEN_ANALYTICS_EVENT = 'pupen:analytics-track';

export type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (eventName: string, options?: { props?: AnalyticsEventParams }) => void;
    umami?: {
      track: (eventName: string, payload?: AnalyticsEventParams) => void;
    };
  }
}

export function trackAnalyticsEvent(name: string, params?: AnalyticsEventParams) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PUPEN_ANALYTICS_EVENT, {
      detail: {
        name: String(name || '').trim(),
        params: params || {},
      },
    }),
  );
}
