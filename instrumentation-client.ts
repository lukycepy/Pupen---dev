import * as Sentry from '@sentry/nextjs';

/**
 * Klientská inicializace Sentry.
 *
 * Nahrazuje dřívější `sentry.client.config.ts`, který Next.js 16 s Turbopackem
 * přestal načítat. Soubor musí být pojmenován `instrumentation-client.ts`.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    // Neodesíláme hlavičky ani cookies, aby do telemetrie neunikala PII.
    if (event.request) {
      if (event.request.headers) event.request.headers = {};
      if (event.request.cookies) event.request.cookies = {};
    }
    return event;
  },
});

/** Instrumentace klientských navigací v App Routeru. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
