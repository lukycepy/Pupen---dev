# Provozní předání Pupen.org (nasazení, obnova, předání)

Tento dokument slouží jako stručný provozní „one‑pager“ pro bezpečné nasazení aplikace Pupen.org, základní obsluhu (včetně plánované odstávky) a postup obnovy po incidentu. Detailní technické kroky jsou uvedeny v [README.md](../../README.md) a v dokumentaci migrací.

## 1) Stručná architektura

- Aplikace: Next.js (veřejný web + členská sekce + Pupen Control).
- Backend: Supabase (Auth + PostgreSQL + Storage).
- E‑maily: SMTP (primárně přes Pupen Control → Email settings, fallback přes env proměnné).
- Ochrana: Cloudflare + rate limit/captcha guardy u veřejných endpointů.
- VPS: hostí pouze Next.js aplikaci (reverse proxy + TLS).

## 2) Nasazení (standardní postup)

### 2.1 Předpoklady

- Přístup k VPS (SSH) a k repozitáři.
- Přístup k Supabase projektu (DB + Auth nastavení).
- Aktualizované tajné klíče v prostředí (viz [secrets-inventory.md](./secrets-inventory.md)).

### 2.2 Kroky nasazení

1. Přepnout do „maintenance“ režimu (volitelné, doporučeno při větších změnách):
   - Pupen Control → Stránky → Plánovaná odstávka (veřejné stránky přesměrují na `/cs/odstavka`, admin a člen zůstává dostupný).
2. Na VPS aktualizovat kód a závislosti:
   - `git pull` na produkční větvi
   - `npm ci`
3. Aplikovat DB migrace (pokud nasazení obsahuje změny DB):
   - `npm run db:migrate:prod`
   - kontrola: `npm run db:drift-check:prod` a `npm run db:rls-check:prod`
4. Build a restart služby:
   - `npm run build`
   - restart systemd služby `pupen` (viz [README.md](../../README.md))
5. Smoke ověření:
   - `/{lang}` homepage
   - `/cs/login` přihlášení
   - `/cs/prihlaska` odeslání přihlášky (test)
   - `/cs/akce` otevření RSVP dialogu a odeslání (test)
   - `/cs/admin/dashboard` přístup pro admin účet

### 2.3 Rollback (návrat k předchozí verzi)

- Kód: návrat na předchozí commit/tag a opakovat build + restart.
- Databáze: pokud se použily nevratné migrace, rollback je „data‑aware“ (obnova ze zálohy nebo ruční korekce). Doporučení: před většími DB změnami provést ověřenou zálohu a zapisovat, jaký SQL zásah byl proveden.

## 3) Plánovaná odstávka (maintenance)

- Aktivace a časové okno: Pupen Control → Stránky → Plánovaná odstávka.
- Chování: veřejná část přesměruje na `/{lang}/odstavka`, členská sekce a administrace zůstává dostupná.
- Poznámka: pokud je nastaven konec odstávky, systém ji po uplynutí automaticky vypne.

## 4) Obnova po incidentu (zjednodušený postup)

### 4.1 Typické scénáře

- A) Incident v aplikaci (chybný deploy / runtime chyba).
- B) Incident v databázi (špatná migrace / nechtěná změna dat).
- C) Incident v e‑mailech (SMTP autentizace / doručování).

### 4.2 Postup obnovy (minimální kroky)

1. Okamžitá stabilizace:
   - zapnout maintenance režim pro veřejnost
   - ověřit dostupnost administrace
2. Diagnostika:
   - logy aplikace (systemd/journalctl)
   - Supabase logy/DB chybovost
3. Návrat do stabilního stavu:
   - rollback aplikace na poslední funkční build
   - u DB incidentu: preferovat obnovu ze zálohy; pokud nejde, provést cílený opravný SQL zásah s auditní stopou
4. Validace:
   - smoke testy (stejné body jako po nasazení)
5. Komunikace:
   - informovat kontakty dle [kontaktni-matrix.md](./kontaktni-matrix.md)

## 5) Předání (co musí být formálně předáno)

- Přístupy:
  - Supabase (projekt, role, MFA)
  - VPS (SSH, systemd, reverse proxy)
  - Cloudflare (DNS, proxy, WAF)
  - E‑mail infrastruktura (SMTP/Mail server)
- Tajné klíče a jejich úložiště: [secrets-inventory.md](./secrets-inventory.md) (bez hodnot).
- Incident/ops kontakty a eskalace: [kontaktni-matrix.md](./kontaktni-matrix.md).
- Prokazatelný minimální postup obnovy: poslední ověřená obnova ze zálohy a datum testu (zapisovat do interní evidence).

