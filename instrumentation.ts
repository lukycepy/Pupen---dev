import * as Sentry from '@sentry/nextjs';

/**
 * Inicializace Sentry pro serverový a edge runtime.
 *
 * Next.js načítá konfiguraci telemetrie výhradně přes `register()` v kořenovém
 * `instrumentation.ts`. Bez tohoto souboru se `sentry.server.config.ts` ani
 * `sentry.edge.config.ts` nikdy nespustí (build na Turbopacku je jinak tiše
 * ignoruje), takže by v produkci nechodily žádné serverové chyby.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Zachytí chyby ze serverových route handlerů, server actions a RSC renderu
 * a odešle je do Sentry (no-op, pokud není nastaveno DSN).
 */
export const onRequestError = Sentry.captureRequestError;
