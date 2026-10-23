# 🎉 Jak rozběhnout Pupen 4.0 (na Ubuntu VPS)

**Tohle je readme pro LUKÁŠE – je to psáno jednoduše jako pro batole.**

Předtím než začneš: **složku `deploy_29_9/` nahraj celou přes WinSCP (nebo rsync) na server, třeba do `/home/lukas/deploy_29_9/`.**
Pak se připoj přes SSH (Bitvise, PuTTY, terminál) a **každý krok dělej PO ČÍSLECH**.

---

## KROK 1️⃣: Přesuň kód do správné složky

V terminálu:

```bash
# PŘEDPOKLAD: máš složku nahranou třeba v /home/lukas/deploy_29_9
# Složka kde běží Pupen je obvykle /var/www/pupen.org/ (případně odkud se spouští PM2 pupen-app)

# 👇 TADY NAPRAV CESTU pokud máš Pupen jinde!
TARGET=/var/www/pupen.org

# Zaloha stareho kodu (pro kazdy pripad)
sudo cp -a "$TARGET" "${TARGET}_zaloha_$(date +%Y%m%d_%H%M%S)" || true

# Vymaz stare komponenty (krome .env a node_modules a .next a apps slozky!)
cd "$TARGET"
sudo find . -mindepth 1 -maxdepth 1 \
  ! -name 'node_modules' \
  ! -name '.next' \
  ! -name '.env' \
  ! -name '.env.local' \
  ! -name 'apps' \
  ! -name 'deploy_29_9' \
  -exec sudo rm -rf {} + 2>/dev/null || true

# Nakopiruj NOVY kod z deploy složky (bez apps – /var/www/pupen.org/apps necháme stát)
sudo cp -a /home/lukas/deploy_29_9/. "$TARGET"/
sudo chown -R "$(whoami):$(whoami)" "$TARGET" 2>/dev/null || sudo chown -R pupen:pupen "$TARGET" 2>/dev/null || true
```

---

## KROK 2️⃣: Zkontroluj a doplň TAJNÉ HODNOTY do .env

V cílové složce (třeba `/var/www/pupen.org/`) MUSÍŠ MÍT SOUBOR `.env`.
Pokud ho tam z nějakého důvodu už není, zkopíruj **šablonu** a doplň hodnoty:

```bash
cd /var/www/pupen.org
cp -n .env.example .env       # -n = nepřepíše pokud už existuje (dobré!)
```

Pak otevři `.env` v `nano` a **Ověř ŽE MÁŠ TYTO HODNOTY** (pokud nějaká chybí → DOPLŇ):

```bash
nano /var/www/pupen.org/.env
```

⚠️ **DŮLEŽITÉ HODNOTY (muset být vyplněné, jinak web půjde rozbitý):**
```
NEXT_PUBLIC_SUPABASE_URL=https://ojnpqxfaiuyfpsogthhx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.……… (dlouhý text)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.………     (jiný dlouhý text, role=service_role)
DATABASE_URL=postgresql://postgres:................................@db.ojnpqxfaiuyfpsogthhx.supabase.co:5432/postgres
APPS_DATA_DIR=/var/www/pupen.org/apps
```

- `SUPABASE_SERVICE_ROLE_KEY` je **NEJDŮLEŽITĚJŠÍ** – bez něj nefunguje admin správa kontaktů v **Aplikace Linka**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` najdeš v **původním starém `.env`** nebo v Supabase dashboardu → Project Settings → API
- `APPS_DATA_DIR` tam musí být, aby se `kontakty.json` ukládal do správné složky pro Nginx

---

## KROK 3️⃣: Nainstaluj závislosti + zbuilduj web

V cílové složce (`/var/www/pupen.org/`):

```bash
cd /var/www/pupen.org

# 1) Nainstaluj závislosti přesně podle package-lock
npm ci || npm install      # npm ci je lepší, pokud tam ale není package-lock, tak npm install

# 2) ZAHRÁDKA (produkční build webu) – trvá ~2–5 minut
npm run build
```

Pokud build skončí zeleně, je to 🥳.

---

## KROK 4️⃣: Vytvoř složku pro aplikace (Linka od Pupenu) + seed data

Tato složka má být na adrese `/var/www/pupen.org/apps/`.
**Tohle je důležité pro mobilní aplikaci Linka od Pupenu.**

```bash
sudo mkdir -p /var/www/pupen.org/apps

# Vlož výchozí kontakty.json (2 lidi: Lukáš Čepelák 1777 a Pupen info 1700)
sudo cp -n /var/www/pupen.org/public/apps/kontakty.json /var/www/pupen.org/apps/kontakty.json

# Dej práva uživateli co běží Pupen
sudo chown -R pupen:pupen /var/www/pupen.org/apps 2>/dev/null || sudo chown -R "$(whoami):$(whoami)" /var/www/pupen.org/apps
sudo chmod 755 /var/www/pupen.org/apps
sudo chmod 644 /var/www/pupen.org/apps/kontakty.json
```

---

## KROK 5️⃣: OPRAVIT NGINX (ABY /apps/ VŽDY FUNGOVALO I BEZ ÚDRŽBY)

Tohle je **NEJDŮLEŽITĚJŠÍ KROK** pro mobilní aplikaci.
Nenechávej to na později, jinak při zapnuté odstávce webu nebude fungovat Linka.

### 5a) Otevři svou Nginx konfiguraci pupen.org

Bývá obvykle tady:
```bash
sudo nano /etc/nginx/sites-available/pupen.org
```

### 5b) Do konfigurace VLOŽ location ^~ /apps/ **PŘED** všemi pravidly pro odstávku / údržbu / maintenance / 503

Kompletní šablona co tam vložit je v souboru:
📁 **`deploy/nginx-pupen-apps.conf.template`** (v deploy složce je tam přiložená)

Zkrátka:
```nginx
# --------------------------------------------------------------------
# APLIKACE / APPS – vynecháno z odstávky, vždy dostupné
# MUSÍ BÝT PŘED pravidly pro maintenance / 503 !!!
# --------------------------------------------------------------------
location ^~ /apps/ {
    alias /var/www/pupen.org/apps/;

    location = /apps/kontakty.json {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        add_header Cache-Control "no-cache, must-revalidate";
        add_header X-Content-Type-Options "nosniff";
        default_type application/json;
        charset utf-8;
        try_files $uri @nextjs_apps_fallback;
    }

    try_files $uri $uri/ @nextjs_apps_fallback;
}

# Fallback pro /apps/* když soubor neexistuje → pošleme to do Next.js (který vrátí defaultní seed data)
location @nextjs_apps_fallback {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3000;      # ← 3000 je port kde běží pupen-app
}
```

### 5c) Existující odstávkové pravidlo UPRAVIT

Pokud máš v konfiguraci něco jako:

```nginx
# ❌ Staré špatně (odstávka zasáhne i /apps/)
if (-f $document_root/maintenance-on) { return 503; }
```

Nahraď za toto (proti /apps/ to nebude platit):

```nginx
# ✅ Nové správně (odstávka NETKNE /apps/)
set $maintenance "";
if (-f $document_root/maintenance-on) { set $maintenance "M"; }
if ($request_uri !~ ^/apps/)           { set $maintenance "${maintenance}A"; }
if ($maintenance = MA)                 { return 503; }
```

### 5d) Ověř + reloaduj Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Pokud se napíše `test is successful` zeleně, jsi dobře. 💚

---

## KROK 6️⃣: RESTART PM2 proces PUPEN-APP

⚠️ **Podle screenshotu co jsi mi poslal, proces se JMENUJE `pupen-app` (ne `pupen`)!**

Takže správný příkaz je:

```bash
pm2 restart pupen-app --update-env
```

Chceš-li vidět jestli běží:
```bash
pm2 list
pm2 logs pupen-app --lines 50
```

---

## KROK 7️⃣: ✅ Ověř že VŠECHNO funguje (povinné!)

1. **Web běží:**
   ```bash
   curl -I https://pupen.org/
   # → Očekávej: 200 OK (nebo 301/302 do /cs/)
   ```

2. **Veřejný JSON pro Linku (CORS + správná hlavička):**
   ```bash
   curl -I -X OPTIONS https://pupen.org/apps/kontakty.json
   # → MUSÍ BÝT Access-Control-Allow-Origin: *
   curl https://pupen.org/apps/kontakty.json
   # → MUSÍ vrátit validní JSON s version, lastUpdated, contacts (2 lidi: 1777 a 1700)
   ```

3. **Odstávkový test (nejdůležitější pro mobilku):**
   ```bash
   # Zapni odstávku
   sudo touch /var/www/pupen.org/maintenance-on

   curl -I https://pupen.org/
   # → Hlavní stránka by měla vrátit 503 (údržba)
   curl -I https://pupen.org/apps/kontakty.json
   # → ❗ MUSÍ vrátit stále 200 (nikdy 503!)

   # Až test skončí, odstávku VYPNI:
   sudo rm /var/www/pupen.org/maintenance-on
   sudo systemctl reload nginx
   ```

4. **Administrace Aplikace Linka:**
   - Otevři si v prohlížeči `https://pupen.org/cs/admin/dashboard`
   - Přihlas se jako superadmin (Lukáš Čepelák)
   - V levém menu **Provoz** by ti mělo být vidět **Aplikace Linka** (ikona telefonu 📞)
   - Vlož test kontakt: **linka = 0000**, ulož, zpátky přehodnot že verze se zvýšila o +1
   - Smaž ho zase

5. **Tmavý režim:**
   - V pravém horním rohu (u jazyka / loginu) je tlačítko (slunce/měsíc).
   - Klikni 3x: světlý ➡️ tmavý ➡️ systém (malá ikonka monitoru dole).
   - V darku by se měly změnit barvy, bez bliknutí.

---

## 📚 Kam co patří – rychlá pomůcka

| Soubor / složka na tvém PC v deploy_29_9 | Kam to patří na server |
|---|---|
| `package.json`, `package-lock.json`, `app/`, `lib/`, `dictionaries/`, `public/`, … | `/var/www/pupen.org/` (hlavní kód webu) |
| `public/apps/kontakty.json` | `/var/www/pupen.org/apps/kontakty.json` (výstupní soubor pro Nginx) |
| `deploy/nginx-pupen-apps.conf.template` | Části vlož do `/etc/nginx/sites-available/pupen.org` PŘED maintenance |
| `.env.example` | Na serveru **přejmenovat na .env** a DOPLNIT HODNOTY |

---

## 🆘 Když něco nefunguje (rychlá help na 1 chvilku)

| Problém | Řešení |
|---|---|
| pm2 restart pupen → error not found | **Používej `pupen-app`**, ne `pupen` – jak je na screenshotu |
| Build selhal kvůli chybějícím envs | Zkontroluj `.env` – hlavně `DATABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY` |
| Admin tab Aplikace Linka ukazuje 500 Internal | Opět chybí SERVICE_ROLE_KEY + restart procesu s `--update-env` |
| /apps/kontakty.json → 404 | Zkontroluj `/var/www/pupen.org/apps/` složku, práva, Nginx alias v `^~ /apps/` |
| Odstávka vypne i mobilní aplikaci | `location ^~ /apps/` musí být **PŘED** maintenance pravidly v Nginxu + upravit podmínku `$request_uri !~ ^/apps/` |
| Tmavý režim se nepřepíná | Zkus Ctrl+F5, nebo `Ctrl+Shift+R` – vymazat cache. Je potřeba, aby v CSS byla Tailwind 4 varianta `@custom-variant dark`. |
| Port 3000 není 3000 | V `@nextjs_apps_fallback` v Nginxu uprav `proxy_pass http://127.0.0.1:TVŮJ_PORT;` + `pm2 show pupen-app` ukáže port |

---

**Hotovo!** 🎂🥳
Pokud máš problém, tak napiš Lukáši K.

---
_Kód balíčku deploy_29_9 = Pupen 4.0 · stav 2026-09-29, Studentský spolek Pupen, z.s._
