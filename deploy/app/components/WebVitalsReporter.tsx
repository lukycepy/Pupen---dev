'use client';

import { useEffect } from 'react';

export function WebVitalsReporter() {
  useEffect(() => {
    // Dynamically import web-vitals so it doesn't block the main thread
    import('web-vitals').then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      const reportMetric = (metric: any) => {
        // Only report if we exceed a certain budget (e.g., LCP > 2500ms)
        const budget: Record<string, number> = {
          LCP: 2500,
          INP: 200,
          CLS: 0.1,
          FCP: 1800,
          TTFB: 600
        };

        const limit = budget[metric.name];
        if (limit && metric.value > limit) {
          fetch('/api/auth/security-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'PERFORMANCE_METRIC',
              details: {
                name: metric.name,
                value: metric.value,
                rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
                path: window.location.pathname
              }
            })
          }).catch(() => {});
        }
      };

      onCLS(reportMetric);
      onINP(reportMetric);
      onLCP(reportMetric);
      onFCP(reportMetric);
      onTTFB(reportMetric);
    }).catch(err => {
      console.warn('Failed to load web-vitals:', err);
    });
  }, []);

  return null;
}
