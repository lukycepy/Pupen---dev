# Seznam tajných klíčů (bez hodnot) a jejich uložení

Tento dokument je inventura tajných klíčů a citlivých konfigurací použitých v projektu Pupen.org. Neobsahuje žádné hodnoty; slouží pro předání přístupů a pro řízenou rotaci klíčů.

## 1) Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
  - Uložení: `.env` (VPS) / Vercel env (náhled), zároveň v Supabase Dashboard.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Uložení: `.env` (VPS) / Vercel env.
- `SUPABASE_SERVICE_ROLE_KEY` (server‑only)
  - Uložení: pouze na serveru (`.env` na VPS / server runtime), nikdy do klienta ani do logů.
- `DATABASE_URL_PROD` (přímé připojení na Postgres)
  - Uložení: `.env` na VPS; přístup spravuje Supabase.

## 2) Aplikace (ochrana endpointů, plánované úlohy)

- `CRON_SECRET` (ochrana `/api/cron/*`)
  - Uložení: `.env` na VPS; zároveň v konfiguraci cron jobů (bez zobrazení v plaintext výstupech).
- `SITE_CONFIG_ID` (není tajné, ale je provozní parametr)
  - Uložení: `.env` na VPS.

## 3) Turnstile / anti‑abuse

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - Uložení: `.env` (VPS) / Vercel env.
- `TURNSTILE_SECRET_KEY`
  - Uložení: `.env` (VPS) / server runtime.

## 4) SMTP (odesílání e‑mailů)

Primární nastavení je přes Pupen Control → Email settings (uloženo v DB). Fallback přes env:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_TLS_REJECT_UNAUTHORIZED`
- `SMTP_TLS_CA_PEM` (citlivá konfigurace, může obsahovat CA chain)

Uložení: `.env` na VPS (fallback). Přístup k primární konfiguraci: Supabase DB + admin oprávnění.

## 5) Webhooky / integrace

- `PUPEN_FIO_WEBHOOK_SECRET`
  - Uložení: `.env` na VPS + nastavení na straně poskytovatele (Fio).

## 6) Analytika (dle poskytovatele)

- `NEXT_PUBLIC_ANALYTICS_PROVIDER`
- `NEXT_PUBLIC_ANALYTICS_SCRIPT_URL`
- `NEXT_PUBLIC_ANALYTICS_SITE_ID`
- `NEXT_PUBLIC_ANALYTICS_DOMAIN`

Pozn.: některé hodnoty mohou být „public“, ale inventura je vede kvůli provozní konzistenci.

## 7) Doména a perimeter

- Cloudflare účet / API tokeny (pokud jsou použity)
  - Uložení: Cloudflare (správa DNS a ochrany).
- Přístupy k VPS (SSH klíče)
  - Uložení: dle interní politiky spolku (doporučeno v password manageru + evidence, kdo má přístup).

## 8) Rotace a minimální pravidla

- Rotace klíčů při incidentu: Supabase keys, CRON_SECRET, webhook secrety, SMTP hesla.
- Minimalizace: `SUPABASE_SERVICE_ROLE_KEY` a další server‑only tajné klíče nesmí být dostupné v klientu.
- Evidence: u každého klíče udržovat „kdo má přístup“ a „kdy proběhla poslední rotace“.

