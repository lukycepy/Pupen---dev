# Deploy na VPS (upload balíček)

Tahle složka obsahuje minimální obsah, který nahraješ na VPS, pokud nechceš deployovat přes `git pull`.

## Co nahrát na VPS
- Nahraj celý adresář `deploy/app` na VPS (doporučená cesta např. `/opt/pupen`).

## Co se dělá na VPS (shrnutí)
1) Nainstaluj Node.js (LTS) + npm.
2) V cílové složce:
   - `npm ci`
   - `npm run build`
3) Nastav environment proměnné (necommitovat, nevkládat do repa):
   - použij `.env.example` jako seznam proměnných
4) Spusť aplikaci:
   - `npm run start` (nebo systemd service)

## Poznámky
- `deploy/app` neobsahuje `.env` a další tajné hodnoty.
- `deploy/app` neobsahuje `node_modules` ani `.next` (ty vznikají na VPS po `npm ci` + `npm run build`).

