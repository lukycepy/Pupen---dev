# Pupen - dev

Webová aplikace Pupen (public web + členská sekce + Pupen Control).

## Spuštění

```bash
npm install
npm run dev
```

## Proměnné prostředí

Zkopírujte `.env.example` → `.env` a doplňte hodnoty:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (pouze server; nepoužívat ve frontendu)
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (odesílání e-mailů)

Soubor `.env` se nikdy necommitne (je v `.gitignore`).

## Skripty

- `npm run dev` – lokální vývoj
- `npm run build` – produkční build
- `npm run start` – spuštění produkčního buildu
- `npm run lint` – lint
