# Monitoring a incident playbook (minimální provozní rámec)

Tento dokument definuje minimální monitoring a postup řešení incidentů pro Pupen.org. Cílem je předvídatelný a auditovatelný proces (nikoli komplexní SRE dokumentace).

## 1) Co monitorovat (minimum)

- Uptime a dostupnost veřejné části: `/{lang}` a `/api/health`.
- Dostupnost administrace: `/cs/admin/dashboard` (aspoň občasný manuální smoke).
- Chybovost a logy aplikace: systemd/journalctl na VPS, případně Sentry (pokud je aktivní).
- DB zdraví: základní metriky v Supabase dashboardu (CPU, connections, errors).
- E‑mail fronta: stav `email_send_queue` (pokud se používá) a výsledek cron jobů.

### 1a) Kontrakt `/api/health` (co je „zdravý stav“)

| Odpověď | HTTP | Význam | Reakce |
|---|---|---|---|
| `{"status":"ok"}` | 200 | DB dostupná, aplikace v pořádku | – |
| `{"status":"degraded"}` | 200 | Aplikace běží, ale chybí konfigurace Supabase | Sev 3 – doplnit env |
| `{"status":"error","message":"Database connection failed"}` | 503 | Nedostupná databáze | Sev 2 – viz sekce 6) |
| jiná odpověď / timeout | 000–5xx | Proces neběží nebo reverse proxy nedostupná | Sev 1 |

Endpoint vrací i `metrics.dbLatencyMs` (lze využít pro trendové měření, není podmínkou alertu).

### 1b) Automatický monitoring a alerting

Monitoring je implementován jako GitHub Actions workflow [`.github/workflows/uptime.yml`](../../../.github/workflows/uptime.yml):

- běží každých 15 minut (`cron: '*/15 * * * *'`) a lze ho spustit i ručně (`workflow_dispatch`),
- volá `PROD_HEALTHCHECK_URL` (repozitářový secret), obvykle `https://pupen.org/api/health`,
- **3 pokusy** s odstupem 10 s → jedna přechodná chyba nevyvolá falešný alert,
- alert se vyhodnotí, pokud po všech pokusech není `HTTP 200` **a zároveň** `"status":"ok"`
  (tj. zachytí i `degraded` a `503`),
- při selhání:
  1. job selže → GitHub pošle notifikaci správcům repozitáře,
  2. volitelně se pošle JSON `{"text": "..."}` na `ALERT_WEBHOOK_URL`
     (Slack/Discord kompatibilní webhook) s URL healthchecku a odkazem na běh.

Bez `PROD_HEALTHCHECK_URL` se workflow přeskočí (no-op), takže nic nepadá zbytečně.

## 2) Jak se incident klasifikuje (prakticky)

- Sev 1: web nebo admin je nedostupný / únik dat / incident s osobními údaji.
- Sev 2: klíčové flow je rozbité (login, přihláška, RSVP, TrustBox).
- Sev 3: nefunkční doplňkové části (newsletter historie, galerie apod.).

## 3) Okamžité kroky (stabilizace)

1. Zapnout plánovanou odstávku pro veřejnost (Pupen Control → Stránky → Plánovaná odstávka). Administrace a členská sekce zůstávají dostupné.
2. Zajistit, že nedochází k dalšímu zhoršování stavu (zastavit problematický cron, vypnout problematickou integraci, rollback aplikace).
3. Pokud se incident týká osobních údajů: neprodleně zapojit GDPR kontakt (viz `kontaktni-matrix.md`).

## 4) Diagnostika (minimum)

- Aplikace (VPS): logy služby, poslední deploy, chyby runtime.
- DB (Supabase): chyby v logu, problémové query, schema cache.
- E‑maily: SMTP ověření, případně `email_send_queue` a bounce logy.

## 5) Obnova (návrat do stabilního stavu)

- Preferovaný postup: rollback na poslední stabilní verzi aplikace.
- U DB problémů: obnova ze zálohy nebo cílená oprava (vždy s evidencí zásahu).
- Po obnově provést minimální smoke testy dle `jak-nasadit-obnovit-predat.md`.

## 6) Evidence incidentů

Do interní evidence zapsat:

- čas detekce, klasifikace (Sev), dopad
- kroky stabilizace a obnova
- zda šlo o incident s osobními údaji a jaké byly komunikační kroky
- preventivní opatření a datum ověření

### 6a) Otevřený incident – `pupen.org/api/health` vrací 503

| Položka | Hodnota |
|---|---|
| Detekce | 2026‑10‑24 (automatická i manuální sonda) |
| Klasifikace | Sev 2 (nedostupná DB na běžícím produkčním nasazení) |
| Projev | `GET https://pupen.org/api/health` → **HTTP 503**, tělo `{"status":"error","message":"Database connection failed"}` (reprodukovatelné opakovaně, 3/3 pokusy) |
| Dopad | Veřejná část webu se načítá (200), ale DB‑vázané funkce (login, přihlášky, admin) jsou nedostupné |
| Poznámka | Běžící nasazení je starší verze na jiném Supabase projektu než Pupen 4.0 (`.env.local`). Před nasazením Pupen 4.0 je nutné ověřit `DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_*` v produkčním prostředí (viz `release-checklist.md`, sekce 2). |
| Stav | Otevřeno – čeká na kontrolu produkčních env proměnných na VPS a Supabase projektu |

**Diagnostický postup pro tento typ incidentu:**

1. Ověřit, že proces běží: `pm2 status pupen-app` (nebo `systemctl status pupen`).
2. Ověřit produkční env: `npm run env:check -- --env prod` (musí projít bez chybějících povinných proměnných).
3. Ověřit konektivitu na Supabase (pooler uživatel `postgres.<project-ref>`, `?uselibpqcompat=true&sslmode=require`).
4. Zkontrolovat Supabase dashboard → Logs (DB errors, connection limit, projekt pozastaven).
5. Po opravě ověřit `{"status":"ok"}` a teprve pak uzavřít incident s datem a zapsaným zásahem.

