# Návrh obrazovek (desktop-first)

## Globální styly
- Layout: desktop-first (min-width 1200px), obsah v kontejneru max-width 1200–1320px; mobilní breakpointy 1024/768/480.
- Typografie: základ 16px; H1 28–32, H2 20–24, text 14–16.
- Barvy: pozadí #0B1220 nebo #0F172A (tmavé), karty #111827; text #E5E7EB; akcent #3B82F6.
- Tlačítka: primary (akcent), secondary (outline), destructive (#EF4444); hover +6% světlejší; disabled 40% opacity.
- Odkazy: podtržení na hover; focus ring 2px.
- Role badge: barva role dle `color_hex`, kontrastní text (auto: bílá/černá podle luminance).

---

## 1) Přihlášení
### Meta
- Title: „Přihlášení“
- Description: „Přihlášení pomocí e‑mailu a hesla.“
- OG: title/description shodné, type=website

### Layout
- Flexbox, dvousloupec: vlevo branding a krátké vysvětlení, vpravo přihlašovací karta.
- Na menších šířkách sloupce pod sebe.

### Struktura
1. Header (minimal): logo + název.
2. Login Card
   - Pole: E‑mail, Heslo.
   - CTA: „Přihlásit“ (primary).
   - Odkaz: „Zapomněli jste heslo?“ → modal/inline sekce.
3. Reset hesla (inline panel)
   - Pole: E‑mail.
   - CTA: „Odeslat odkaz“.
4. Stavové zprávy
   - Úspěch/selhání přihlášení; error pro špatné heslo; info pro „pending účet – čeká na schválení“.

Interakce/stavy:
- Loading spinner na CTA.
- Validace e‑mail formátu, povinná pole.

---

## 2) Aplikace
### Meta
- Title: „Aplikace“
- Description: „Práce s adresami přes RÚIAN.“
- OG: title/description

### Layout
- CSS Grid: 12 sloupců.
- Horní lišta (sticky) + hlavní obsah ve dvou panelech (8/4).

### Struktura
1. Top Bar
   - Vlevo: název aplikace.
   - Vpravo: uživatel (e‑mail), role badge (barva), menu: „Odhlásit“.
2. Panel „RÚIAN test“ (8/12)
   - Input „Adresa / dotaz“.
   - Přepínač režimu: Search / Validate (segmented control).
   - CTA: „Spustit“.
   - Výsledek: tabulka nebo seznam karet (minimální normalizovaná pole + raw JSON v collapsible).
3. Panel „Stav a provider“ (4/12)
   - Karta „Aktivní provider“ (read-only) + poslední změna (kdo/kdy).
   - Karta „Stav účtu“: pending/approved/blocked + vysvětlení.
   - Odkaz „Admin portál“ pouze viditelný pro admin roli; pro ostatní skrytý (primárně) nebo zobrazený jako disabled s tooltipem.

Interakce:
- Zobrazení error banneru při chybě providera (timeout, rate limit, 4xx/5xx).

---

## 3) Admin portál
### Meta
- Title: „Admin portál“
- Description: „Schvalování přístupů, role/oprávnění, nastavení provideru a schema cache.“
- OG: title/description

### Layout
- Left sidebar + content area.
- Sidebar: navigace sekcí; content: karty s tabulkami a formuláři.

### Gating
- Pokud uživatel není admin: plná stránka „Nemáte oprávnění“
  - Text: proč (role), CTA: „Zpět do aplikace“.

### Struktura (admin)
1. Sidebar
   - „Přístupy“
   - „Role & Oprávnění“
   - „RÚIAN Provider“
   - „Schema cache“
2. Sekce „Přístupy“
   - Tabulka žádostí: e‑mail, status, created_at, akce.
   - Akce: Schválit / Zamítnout.
   - Po schválení: potvrzovací modal + info „Přístup bude automaticky vygenerován a odeslány instrukce“.
3. Sekce „Role & Oprávnění“
   - Role list: název + barevný badge + počet uživatelů.
   - Detail role: picker barvy (hex + preview), checklist oprávnění.
   - Přiřazení role uživateli: vyhledání uživatele + dropdown role.
4. Sekce „RÚIAN Provider“
   - Dropdown dostupných providerů + popis (např. latence, limit).
   - CTA: „Uložit a aktivovat“ + audit info (kdo/kdy).
5. Sekce „Schema cache“
   - Karta „Stav“: aktuální `schema_cache_version`, poslední refresh, počet klíčů.
   - Karta „Akce“: Invalidate (destructive) + Refresh.
   - Diagnostika: tabulka nejnovějších záznamů (cache_key, version, updated_at, provider) + filtrování.

Animace:
- Jemné přechody (150–200ms) na hover, otevření modalů.
