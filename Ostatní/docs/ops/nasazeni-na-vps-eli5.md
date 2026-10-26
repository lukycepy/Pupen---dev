# Nasazení na VPS – vysvětleno jednoduše (ELI5)

Tento dokument je záměrně psaný velmi jednoduše, aby nasazení zvládl i člověk, který
to nedělá každý den. Technický a detailní postup je v [README.md](../../README.md),
tento text je jeho „lidská" verze.

## Představa

Váš web jsou tři věci na třech místech:

- **Recept (kód)** = složka `pupen 4.0` na Vašem počítači.
- **Kuchyň (VPS)** = pronajatý počítač na internetu, kde se web „uvaří" a běží pořád.
- **Sklad surovin (Supabase)** = databáze a přihlašování. Ten na VPS **vůbec neběží** –
  web se k němu jen připojuje.

VPS tedy jen „uvaří recept" a vydrží ho servírovat. Návštěvník přijde na `pupen.org` →
Nginx ho pošle do kuchyně → tam odpoví Next.js.

## 1) Jednorázová příprava VPS

Přihlaste se na VPS (`ssh uživatel@IP-adresa`) a nainstalujte „kuchyňské nádobí":

```bash
sudo apt update
sudo apt install -y nginx git

# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo npm install -g pm2
```

Na doméně nastavte **DNS**: `A pupen.org -> IP Vašeho VPS`
(volitelně i `A www.pupen.org -> IP VPS`). Tím lidé trefí do správné kuchyně.

## 2) Vložit recept do kuchyně

Přes Git:

```bash
git clone <repo>
cd "pupen 4.0"
```

Nebo nahrajte obsah `Ostatní/deploy/app` (pokud nechcete řešit Git).
Doporučená cesta na VPS je `/opt/pupen`.

## 3) Dát kuchaři tajné klíče (`.env`)

```bash
cp .env.example .env
nano .env
```

Minimálně musí být vyplněné:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://pupen.org`
- `DATABASE_URL_PROD`
- `CRON_SECRET`

**Tento soubor nikdy nedávejte do Gitu** – jsou v něm hesla.
Kontrola, co Vám chybí: `npm run env:check`.

## 4) Uvařit a nastartovat

```bash
npm ci          # nainstaluje přesné verze balíčků
npm run build   # "uvaří" web do složky .next
```

Spuštění tak, aby web běžel pořád (i po zavření terminálu nebo restartu VPS):

```bash
pm2 start npm --name pupen-app -- start
pm2 save
pm2 startup     # vypíše jeden příkaz, ten ještě spusťte – zajistí start po rebootu
```

Kontrola, že to žije:

```bash
pm2 status
pm2 logs pupen-app
```

## 5) Postavit vrátnici (Nginx + HTTPS)

Nginx je vrátný: vezme návštěvníka na `pupen.org` a pošle ho do kuchyně na port 3000.
Vzor konfigurace je v [nginx-pupen-apps.conf.template](../../deploy/nginx-pupen-apps.conf.template),
klíčová část:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Zapnutí a vyrobení „zámečku" (HTTPS certifikát):

```bash
sudo ln -sf /etc/nginx/sites-available/pupen.org /etc/nginx/sites-enabled/pupen.org
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pupen.org -d www.pupen.org
```

> **Pozor:** blok `location ^~ /apps/` musí být v Nginxu **nad** pravidly pro odstávku,
> aby aplikace zůstaly dostupné i při maintenance režimu. Je to okomentované přímo
> v templatu.

## 6) Příště už jen aktualizace (rutina)

Když změníte kód, na VPS stačí:

```bash
cd /opt/pupen
git pull
npm ci
npm run build
pm2 restart pupen-app
```

Pokud nasazení obsahuje změny v databázi, před restartem ještě:

```bash
npm run db:migrate:prod
```

## 7) Pravidla bezpečného kuchaře

1. **Před větší změnou** zapněte v adminu odstávku
   (`Pupen Control -> Stránky -> Plánovaná odstávka`) – veřejnost vidí info stránku,
   admin a členové fungují dál.
2. **Před DB změnou** udělejte zálohu: `npm run backup:db`.
3. Když se něco rozbije, vraťte se na předchozí funkční commit a znovu
   `build` + `pm2 restart pupen-app`.

## Celé to v pěti větách

1. Nahraj kód do kuchyně.
2. Vyplň `.env`.
3. `npm ci && npm run build`.
4. `pm2 start` + Nginx s HTTPS.
5. Příště jen `git pull`, `build`, `restart`.

## Související dokumenty

- [README.md](../../README.md) – kompletní technický postup nasazení.
- [jak-nasadit-obnovit-predat.md](./jak-nasadit-obnovit-predat.md) – provozní one-pager.
- [secrets-inventory.md](./secrets-inventory.md) – seznam tajných klíčů (bez hodnot).
- [release-checklist.md](./release-checklist.md) – checklist před spuštěním.
