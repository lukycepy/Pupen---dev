# Pupen (pupen.org) — Developer & VPS README

Public web + Členská sekce + Pupen Control (admin). Aplikace je Next.js a jako backend používá Supabase (Auth + Postgres + Storage).

## Rychlý start (lokálně)

### Požadavky
- Node.js 20+
- npm
- Supabase projekt (nebo lokální Postgres kompatibilní s migracemi)

### Instalace a běh
```bash
npm install
cp .env.example .env
npm run dev
```

### Migrace (Supabase DB)
Pokud uvidíš chyby typu `Could not find ... in the schema cache`, chybí migrace nebo schema cache reload.

- Automaticky přes skript (doporučeno):
  - `npm run db:migrate` (bere `DATABASE_URL`)
  - `npm run db:migrate:prod` (bere `DATABASE_URL_PROD`, fallback `DATABASE_URL`)
- Diagnostika:
  - `npm run db:drift-check`
  - `npm run db:rls-check`

Podrobnosti: [supabase-migrations.md](file:///c:/Users/Lukas/Downloads/pupen%204.0/docs/supabase-migrations.md) a [migrace/README.md](file:///c:/Users/Lukas/Downloads/pupen%204.0/migrace/README.md)

## Proměnné prostředí (.env)

Zkopíruj `.env.example` → `.env` a doplň hodnoty. `.env` se nikdy necommitne.

### Povinné (produkce)
- `NEXT_PUBLIC_SITE_URL=https://pupen.org`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `DATABASE_URL_PROD` (přímé připojení do Supabase Postgres)
- `CRON_SECRET` (ochrana `/api/cron/*`)

### Doporučené (produkce)
- `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_ANALYTICS_DOMAIN=pupen.org` (+ další analytics dle poskytovatele)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` a `TURNSTILE_SECRET_KEY` (ochrana loginu)
- `PUPEN_FIO_WEBHOOK_SECRET` (pokud používáš FIO webhooky)

### E‑maily (SMTP)
E‑maily lze nastavit dvěma způsoby:
- Primárně přes admin UI (Pupen Control → Email settings), kde se uloží do DB (`email_settings`)
- Fallback přes env proměnné:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
  - `SMTP_TLS_REJECT_UNAUTHORIZED` (default `true`)
  - `SMTP_TLS_CA_PEM` (PEM chain, pokud SMTP padá na certifikáty)

Pokud SMTP hlásí `unable to verify the first certificate`, vlož CA chain do admin nastavení (TLS CA PEM) nebo nastav `SMTP_TLS_CA_PEM`. Nevypínej ověřování certifikátu v produkci, pokud to není krátkodobý workaround.

## Nasazení na VPS (Ubuntu) pro pupen.org

Níže je minimální, spolehlivý setup. Počítá s tím, že DB + Auth běží v Supabase a na VPS běží pouze Next.js app.

### 1) DNS
- `A pupen.org -> <IP VPS>`
- `A www.pupen.org -> <IP VPS>` (volitelně, bude redirect na pupen.org)

### 2) Instalace runtime (VPS)
Na VPS nainstaluj:
- Node.js 20+
- git

### 3) Deploy aplikace
```bash
git clone <repo>
cd pupen\ 4.0
npm ci
cp .env.example .env
```

Vyplň `.env` (viz výše). Minimálně: Supabase URL/keys + service role + `NEXT_PUBLIC_SITE_URL=https://pupen.org` + `DATABASE_URL_PROD` + `CRON_SECRET`.

Build a start:
```bash
npm run build
npm run start
```

### 4) Systemd (doporučeno)
Vytvoř systemd unit, aby app běžela po restartu:

`/etc/systemd/system/pupen.service`
```ini
[Unit]
Description=Pupen (Next.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/pupen
EnvironmentFile=/opt/pupen/.env
ExecStart=/usr/bin/npm run start -- --port 3000
Restart=always
RestartSec=5
User=www-data

[Install]
WantedBy=multi-user.target
```

Aktivace:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pupen
sudo systemctl status pupen
```

Logy:
```bash
sudo journalctl -u pupen -f
```

### 5) Reverse proxy + TLS (Caddy)
Nejjednodušší cesta je Caddy (automatické TLS):

`/etc/caddy/Caddyfile`
```caddy
pupen.org {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}

www.pupen.org {
  redir https://pupen.org{uri} permanent
}
```

Restart:
```bash
sudo systemctl reload caddy
```

### 5b) Reverse proxy + TLS (Nginx + Certbot)
Alternativa pro VPS, pokud používáš Nginx:

1) Nainstaluj Nginx + Certbot:
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

2) Vytvoř Nginx konfiguraci:

`/etc/nginx/sites-available/pupen.org`
```nginx
server {
  listen 80;
  server_name pupen.org www.pupen.org;

  location /.well-known/acme-challenge/ {
    root /var/www/html;
  }

  location / {
    return 301 https://pupen.org$request_uri;
  }
}

server {
  listen 443 ssl http2;
  server_name pupen.org;

  # Certifikáty doplní certbot po prvním runu
  ssl_certificate     /etc/letsencrypt/live/pupen.org/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/pupen.org/privkey.pem;

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

3) Aktivuj site a ověř konfiguraci:
```bash
sudo ln -sf /etc/nginx/sites-available/pupen.org /etc/nginx/sites-enabled/pupen.org
sudo nginx -t
sudo systemctl reload nginx
```

4) Vydání certifikátu + auto-renew:
```bash
sudo certbot --nginx -d pupen.org -d www.pupen.org
sudo systemctl status certbot.timer
```

### 6) Supabase konfigurace pro pupen.org
V Supabase nastav:
- Auth → URL Configuration:
  - Site URL: `https://pupen.org`
  - Additional Redirect URLs:
    - `https://pupen.org/*`
    - `http://localhost:3000/*` (pro lokál)
- Auth → MFA:
  - povolit TOTP
  - povolit WebAuthn (Passkeys), aby šlo přidávat passkeys v /clen

### 7) Cron joby (e‑mail fronta, digest, expiry)
Endpointy jsou chráněné `CRON_SECRET`. Nastav cron (např. `/etc/cron.d/pupen`):

```cron
* * * * * root curl -fsS \"https://pupen.org/api/cron/email-queue?secret=$CRON_SECRET\" >/dev/null
*/10 * * * * root curl -fsS \"https://pupen.org/api/cron/digest?secret=$CRON_SECRET\" >/dev/null
0 3 * * * root curl -fsS \"https://pupen.org/api/cron/membership-expiry?secret=$CRON_SECRET\" >/dev/null
```

Poznámka: pokud používáš Cloudflare proxy, ověř, že cron běží z VPS (ne z browseru) a že odpovědi nejsou cachované.

### 8) Plánovaná odstávka
Pupen Control → Stránky → Plánovaná odstávka:
- veřejné stránky se redirectují na `/${lang}/odstavka`
- admin a člen zůstává dostupný

## Smoke test (po deployi)
- `https://pupen.org/cs` načte homepage
- `https://pupen.org/cs/login` funguje přihlášení + reset hesla
- `https://pupen.org/cs/admin` a `.../admin/dashboard` funguje pro admin účet
- `https://pupen.org/sitemap.xml` a `https://pupen.org/robots.txt` vrací očekávaný obsah
- cron `/api/cron/email-queue` s `CRON_SECRET` vrací OK a fronta se zmenšuje

## Bezpečnostní poznámky
- Žádné tajné klíče necommituj do repozitáře ani nesdílej v logách.
- Pokud se tajný klíč někde objevil (např. v `.env` nebo screenshotu), zrotuj ho v poskytovateli (Supabase, Turnstile, Google, atd.).
