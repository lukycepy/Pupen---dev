# Monitoring a incident playbook (minimální provozní rámec)

Tento dokument definuje minimální monitoring a postup řešení incidentů pro Pupen.org. Cílem je předvídatelný a auditovatelný proces (nikoli komplexní SRE dokumentace).

## 1) Co monitorovat (minimum)

- Uptime a dostupnost veřejné části: `/{lang}` a `/api/health`.
- Dostupnost administrace: `/cs/admin/dashboard` (aspoň občasný manuální smoke).
- Chybovost a logy aplikace: systemd/journalctl na VPS, případně Sentry (pokud je aktivní).
- DB zdraví: základní metriky v Supabase dashboardu (CPU, connections, errors).
- E‑mail fronta: stav `email_send_queue` (pokud se používá) a výsledek cron jobů.

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

## 6) Evidence incidentu (záznam)

Do interní evidence zapsat:

- čas detekce, klasifikace (Sev), dopad
- kroky stabilizace a obnova
- zda šlo o incident s osobními údaji a jaké byly komunikační kroky
- preventivní opatření a datum ověření

