# Release checklist – předprodukční kontrola

Krátký, opakovatelný seznam kontrol před nasazením nové verze na produkci.
Vychází z inventury tajných klíčů (`secrets-inventory.md`) a z konfigurace
v kódu (`next.config.mjs`, `instrumentation.ts`, `instrumentation-client.ts`,
`sentry.server|edge.config.ts`, `proxy.ts`, `app/api/*`).

## 1) Ověření kódu (lokálně / v CI)

- [ ] `npx tsc --noEmit` – 0 chyb.
- [ ] `npm run lint` – 0 chyb, 0 warningů.
- [ ] `npm run build` – produkční build projde.
- [ ] `npx playwright test` – smoke + auth e2e projdou.
- [ ] `npm run env:check -- --env prod` – povinné env proměnné jsou nastavené
  (skript kontroluje i `?sslmode=require` u `DATABASE_URL`).
- [ ] Migrace: `npm run db:migrate -- --env prod` (po `supabase link`).
- [ ] CI `db-checks.yml`: repozitářový secret `DATABASE_URL` míří na Supabase
  pooler (viz `secrets-inventory.md`) – GitHub runners nemají IPv6.

> Spustitelné kontrole env předchází údržba inventáře: každá proměnná použitá
> v kódu (`process.env.*`) musí být uvedená v `.env.example`.

## 2) Povinné env proměnné (server / VPS `.env`)

Aplikace bez nich nefunguje nebo běží v degradovaném režimu:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` – URL projektu Supabase.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` – veřejný anon klíč.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` – server-only (nikdy do klienta).
- [ ] `NEXT_PUBLIC_SITE_URL` – kanonická URL (odkazy v e-mailech, PDF).
- [ ] `DATABASE_URL` (a případně `DATABASE_URL_PROD` / `_STAGING`) – musí obsahovat `?sslmode=require`.
  - Pokud běžíte skripty přes Supabase pooler a Node odmítne certifikát
    (`self-signed certificate in certificate chain`), použijte režim kompatibility
    s libpq: `?uselibpqcompat=true&sslmode=require`.

## 3) Doporučené / volitelné env proměnné

- [ ] `CRON_SECRET` – ochrana `/api/cron/*` (bez něj jsou cron endpointy nechráněné/nefunkční).
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

### 3b) E2E integrační testy (volitelné, doporučené pro RC)

Bez těchto proměnných se integrační scénáře v `Ostatní/tests` přeskočí
(`test.skip('Missing E2E env')`) a ověří se jen smoke testy:

- [ ] `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` – účet s právem SuperAdmin/Admin.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` – veřejné klíče.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` – pro přípravu a úklid testovacích dat.

## 4) Monitoring a telemetrie

- [ ] `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_DSN`) – bez DSN je Sentry no-op (build neselže).
- [ ] `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` – nahrávání source map.
- [ ] Inicializace Sentry je navěšená přes `instrumentation.ts` (nodejs + edge)
  a `instrumentation-client.ts`. Soubor `sentry.client.config.ts` už neexistuje
  (Next.js 16 + Turbopack ho nenačítá).
- [ ] Po nasazení ověřit, že událost skutečně dorazí: vyvolat testovací chybu
  (např. `/api/health` s vypnutou DB) a zkontrolovat ji v Sentry issue streamu.
- [ ] Repozitářový secret `PROD_HEALTHCHECK_URL` – zapíná `uptime.yml`
  (kontrakt a retry logika: viz `incident-playbook-monitoring.md`, sekce 1a/1b).
- [ ] Volitelný secret `ALERT_WEBHOOK_URL` – Slack/Discord webhook pro alert při výpadku.
- [ ] Ověřit ručně `GET {NEXT_PUBLIC_SITE_URL}/api/health` → `{"status":"ok"}`
  (503 = nedostupná DB, 200 s `"degraded"` = chybí konfigurace Supabase).

## 5) Infrastruktura a runtime

- [ ] PM2 proces `pupen-app` běží a je nastaven na autostart (`pm2 save`).
- [ ] Nginx: `/apps/` a `/apps/kontakty.json` vyjmuty z maintenance režimu.
- [ ] Supabase pooler používá uživatele ve formátu `postgres.<project-ref>`.
- [ ] Cron joby (externí plánovač) volají `/api/cron/*` s platným `CRON_SECRET`.
- [ ] Zálohy: poslední úspěšný běh `backup-run.mjs` + záznam v `zaznam-testu-obnovy.md`.

## 6) Funkční průchod po nasazení (smoke)

### 6a) Bez přihlášení (lze hned)

- [ ] Veřejný web se načte (`/`, `/cs`, `/en`).
- [ ] `GET /api/health` → HTTP 200 a tělo obsahuje `"status":"ok"`.
- [ ] Cron endpointy bez `CRON_SECRET` vracejí 403 (a `dm-reminders` na GET 405).
- [ ] Logout vrací na `/login`.

### 6b) S přihlášením (vyžaduje `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`)

Předpoklad: v `.env.local` (nebo v env na CI) jsou nastavené
`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
Bez nich se integrační scénáře přeskočí (`test.skip('Missing E2E env')`).

- [ ] `npx playwright test` – integrační scénáře už nejsou přeskočené
  (`admin-analytics`, `security-bans`, `site-page-permissions`).
- [x] Login přes alias e-mail → přihlásí se kanonickým účtem.
  Ověřeno 2026-10-24 proti produkční instanci (bez `E2E_ADMIN_EMAIL`): dočasný
  probe účet vytvořený přes admin API + alias v `user_login_aliases`;
  `POST /api/auth/resolve-login` s aliasem vrátil kanonický e-mail,
  `POST /auth/v1/token?grant_type=password` vydal session a
  `GET /api/auth/me-profile` s tímto tokenem vrátil profil s aliasem v
  `login_aliases`. Probe účet i alias po ověření smazány (tabulka prázdná).
- [x] Multi-role účet (`Admin` + `Člen`) → po loginu se zobrazí výběr
  `/admin` vs `/clen` a obě větve se otevřou.
  Ověřeno 2026-10-24 ve dvou krocích: (1) proti produkci `me-profile` vrátil
  současně `has_admin_access: true` i `has_member_access: true` – to je přesně
  stav, kdy `LoginPageClient` zobrazí výběr role (reálný účet v produkci:
  `cepelak@pupen.org`, `is_admin = t`, `is_member = t`); (2) UI větev pokrývají
  e2e testy v `auth.spec.ts` – výběr role (`role-select-admin`/`role-select-member`),
  member-only → `/cs/clen` a admin-only → `/cs/admin/dashboard`.
- [ ] Admin → upload obrázku (uloží se do bucketu, vrátí `publicUrl`,
  zapíše se `admin_logs` akce `UPLOAD_FILE`).
- [ ] Admin → newsletter (testovací kampaň na vlastní e-mail; zkontrolovat
  `newsletter` záznam a `admin_logs` akci `NEWSLETTER_SENT`).
- [ ] Admin → faktury (vytvoření dokladu; ověřit RPC `billing_invoice_create`
  a auditní záznam `billing_invoice.create`).
- [ ] TrustBox → odeslání podnětu školním e-mailem (ČZU) → dorazí ověřovací
  e-mail s kódem → ověření v `/schranka-duvery/overit`.

### 6c) Zaznamenání výsledku

- [ ] Do `zaznam-testu-obnovy.md` zapsat datum, cíl a výsledek testu obnovy
  (sekce 2) – vyžaduje `DATABASE_URL_STAGING`.
- [ ] Zálohy: spustit `backup-run.mjs`, poté `verify-backup.mjs`; výsledek
  zapsat do sekce 1 téhož souboru.
