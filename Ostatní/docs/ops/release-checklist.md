# Release checklist – předprodukční kontrola

Krátký, opakovatelný seznam kontrol před nasazením nové verze na produkci.
Vychází z inventury tajných klíčů (`secrets-inventory.md`) a z konfigurace
v kódu (`next.config.mjs`, `sentry.*.config.ts`, `proxy.ts`, `app/api/*`).

## 1) Ověření kódu (lokálně / v CI)

- [ ] `npx tsc --noEmit` – 0 chyb.
- [ ] `npm run lint` – 0 chyb, 0 warningů.
- [ ] `npm run build` – produkční build projde.
- [ ] `npx playwright test` – smoke + auth e2e projdou.
- [ ] Migrace: `npm run db:migrate -- --env prod` (po `supabase link`).

## 2) Povinné env proměnné (server / VPS `.env`)

Aplikace bez nich nefunguje nebo běží v degradovaném režimu:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` – URL projektu Supabase.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` – veřejný anon klíč.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` – server-only (nikdy do klienta).
- [ ] `NEXT_PUBLIC_SITE_URL` – kanonická URL (odkazy v e-mailech, PDF).
- [ ] `DATABASE_URL` (a případně `DATABASE_URL_PROD` / `_STAGING`) – musí obsahovat `?sslmode=require`.

## 3) Doporučené / volitelné env proměnné

- [ ] `CRON_SECRET` – ochrana `/api/cron/*` (bez něj jsou cron endpoointy nechráněné/nefunkční).
- [ ] `SITE_CONFIG_ID` – provozní parametr.
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` – anti-abuse na loginu.
- [ ] `PUPEN_FIO_WEBHOOK_SECRET` – ověření Fio webhooku.
- [ ] `BOUNCE_WEBHOOK_SECRET` – ověření webhooku pro e-mailové bouncy.
- [ ] `APPLICATION_LINK_SECRET` – podepisování odkazů v přihláškách (fallback na service-role klíč).
- [ ] `EMAIL_FROM` – odesílatel systémových e-mailů.
- [ ] `SMTP_*` – fallback SMTP (primárně se bere z DB přes admin → Email settings).
- [ ] `ENABLE_EMAIL_TESTS` – `'true'` jen mimo produkci (jinak je test endpoint zakázaný).
- [ ] `CSP_ENFORCE` – `'1'` přepne CSP z Report-Only na vynucený režim.
- [ ] `NEXT_IMAGE_REMOTE_HOSTS` – čárkou oddělené domény pro `next/image`.

## 4) Monitoring a telemetrie

- [ ] `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_DSN`) – bez DSN je Sentry no-op (build neselže).
- [ ] `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` – nahrávání source map.
- [ ] Repozitářový secret `PROD_HEALTHCHECK_URL` – zapíná `uptime.yml`.
- [ ] Ověřit ručně `GET {NEXT_PUBLIC_SITE_URL}/api/health` → `{"status":"ok"}`.

## 5) Infrastruktura a runtime

- [ ] PM2 proces `pupen-app` běží a je nastaven na autostart (`pm2 save`).
- [ ] Nginx: `/apps/` a `/apps/kontakty.json` vyjmuty z maintenance režimu.
- [ ] Supabase pooler používá uživatele ve formátu `postgres.<project-ref>`.
- [ ] Cron joby (externí plánovač) volají `/api/cron/*` s platným `CRON_SECRET`.
- [ ] Zálohy: poslední úspěšný běh `backup-run.mjs` + záznam v `zaznam-testu-obnovy.md`.

## 6) Funkční průchod po nasazení (smoke)

- [ ] Veřejný web se načte (`/`, `/cs`, `/en`).
- [ ] Login (běžný i přes alias) a výběr `/admin` vs `/clen`.
- [ ] Admin: upload obrázku, newsletter, faktury, TrustBox.
- [ ] Logout vrací na `/login`.
