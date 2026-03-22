# Stabilizace mailů, odstávky a resetu hesel Spec

## Why
Momentálně selhává odesílání e‑mailů (např. `connect ETIMEDOUT …:586`), což blokuje notifikace i obnovu hesla. Zároveň má maintenance režim působit jako „single page“ (podobně jako custom 404) a admin potřebuje řídit reset hesel i obsah/personalizaci portálů.

## What Changes
- Opravit spolehlivost odesílání e‑mailů a zlepšit diagnostiku (admin logy + test).
- Maintenance režim má zobrazit pouze stránku odstávky (bez navigace a ostatních stránek); kontakty v textu mají být klikatelné; časové okno se musí vyhodnocovat správně.
- Admin má mít rich editor pro obsah odstávky (CZ/EN).
- Přidat „Forgotten password“ flow pro uživatele (žádost + nastavení nového hesla).
- Umožnit adminovi odeslat reset/nové heslo a měnit heslo (včetně změny hesla účtu uživatele).
- Umožnit adminovi vytvářet pojmenované role (např. „Předseda“) a přidělovat jim oprávnění; uživatelům lze role přiřadit.
- Přidat volitelné 2FA a/nebo propojení účtu s Google účtem po prvotním přihlášení.
- Umožnit adminovi upravovat členskou sekci z admin controlu (konfigurace viditelnosti a obsahu).
- Přidat personalizaci UI pro admin control i členský portál (nastavení preferencí).
- Zajistit CZ/EN lokalizaci pro nové i dotčené části adminu a členské sekce.

## Impact
- Affected specs: e‑mailing, autentizace, maintenance režim, admin control, členský portál, i18n.
- Affected code: `lib/email/*`, `app/api/admin/*` (mail a password), `app/[lang]/odstavka`, middleware `proxy.ts`, `app/[lang]/login`, `app/[lang]/admin/dashboard/*`, `app/[lang]/clen/*`, `dictionaries/*.json`, `supabase/migrations/*`.

## ADDED Requirements

### Requirement: Stabilní odesílání e‑mailů
Systém SHALL odesílat e‑maily přes SMTP konfiguraci z nastavení a při chybě vrátit čitelnou diagnostiku (kód chyby, host/port bez citlivých údajů) v admin logu.

#### Scenario: SMTP timeout
- **WHEN** dojde k timeoutu spojení (např. port 586)
- **THEN** admin uvidí jasnou chybu a doporučení (ověřit host/port, firewall, TLS režim), bez úniku hesla/secretů

### Requirement: Maintenance stránka jako jediný obsah
Systém SHALL při aktivní odstávce zobrazovat pouze stránku odstávky pro všechny veřejné cesty (podobně jako custom 404), bez navbaru a bez přístupu k ostatním stránkám.

#### Scenario: Aktivní odstávka
- **WHEN** je odstávka aktivní a uživatel otevře libovolnou veřejnou URL
- **THEN** zobrazí se pouze UI odstávky
- **AND** odpověď nese hlavičky vhodné pro odstávku (např. `Cache-Control: no-store`), ideálně status 503 pokud je to technicky možné

#### Scenario: Konec odstávky (automaticky)
- **WHEN** nastane `maintenance_end_at`
- **THEN** systém přestane uživatele přesměrovávat na odstávku a veřejný web je opět dostupný
- **AND** `/[lang]/odstavka` se přesměruje na `/[lang]` (pokud není odstávka aktivní)

#### Scenario: Klikatelné kontakty
- **WHEN** je v textu odstávky e‑mail nebo telefon
- **THEN** je v UI vykreslen jako odkaz `mailto:` / `tel:`

### Requirement: Rich editor pro odstávku (admin)
Systém SHALL umožnit adminovi upravit obsah odstávky (title/body) v CZ/EN pomocí rich editoru (např. WYSIWYG) a bezpečně jej zobrazit na stránce odstávky.

#### Scenario: Úprava obsahu
- **WHEN** admin uloží obsah odstávky v rich editoru
- **THEN** obsah se okamžitě projeví na `/[lang]/odstavka` při příštím načtení
- **AND** renderování neumožní injektovat škodlivý skript (žádný XSS)

### Requirement: Forgotten password (uživatel)
Systém SHALL umožnit uživateli vyžádat obnovu hesla a nastavit nové heslo bezpečným postupem.

#### Scenario: Žádost o obnovu
- **WHEN** uživatel zadá e‑mail do „Zapomenuté heslo“
- **THEN** systém odešle e‑mail s instrukcemi pro změnu hesla (bez zveřejnění, zda účet existuje)

#### Scenario: Nastavení nového hesla
- **WHEN** uživatel otevře obnovovací odkaz a zadá nové heslo
- **THEN** heslo se změní a uživatel je přesměrován do portálu

### Requirement: Reset / změna hesla (admin)
Systém SHALL umožnit adminovi:
- odeslat uživateli reset hesla (email flow),
- nastavit uživateli nové heslo (jen s příslušným oprávněním),
- měnit heslo i pro vlastní účet.

#### Scenario: Admin nastaví nové heslo
- **WHEN** admin s oprávněním provede „nastavit nové heslo“
- **THEN** heslo se změní, akce se zaloguje do admin logů a uživatel je informován e‑mailem

### Requirement: Admin konfigurace členské sekce
Systém SHALL poskytnout v admin controlu editor konfigurace členského portálu (viditelnost sekcí, texty, rychlé odkazy).

#### Scenario: Skrytí sekce
- **WHEN** admin vypne sekci v konfiguraci
- **THEN** sekce se v členském portálu nezobrazí

### Requirement: Personalizace UI (admin + člen)
Systém SHALL umožnit per‑uživatelské UI preference (např. výchozí tab, zobrazení onboarding karty, případně kompaktní režim).

### Requirement: Pojmenované role a oprávnění
Systém SHALL umožnit spravovat pojmenované role (např. „Předseda“, „Místopředseda“, „Redaktor“) a jejich oprávnění, a přiřazovat tyto role uživatelům.

#### Scenario: Vytvoření role
- **WHEN** superadmin vytvoří roli s názvem a sadou oprávnění
- **THEN** role je dostupná k přiřazení uživatelům

#### Scenario: Přiřazení role uživateli
- **WHEN** admin přiřadí roli uživateli
- **THEN** uživatel získá odpovídající oprávnění (a změna se projeví po refresh/relogin)

#### Scenario: Audit a bezpečnost
- **WHEN** dojde ke změně role/oprávnění
- **THEN** akce se zaloguje do admin logů a systém neumožní eskalaci bez oprávnění (minimálně superadmin)

### Requirement: Volitelné 2FA / Google propojení
Systém SHALL umožnit uživateli po prvotním přihlášení volitelně:
- zapnout 2FA (preferovaně TOTP),
- nebo propojit účet s Google účtem (OAuth), aby se mohl přihlašovat přes Google.

#### Scenario: Zapnutí 2FA
- **WHEN** uživatel v nastavení zabezpečení zapne 2FA
- **THEN** systém provede enrolment (QR/secret), ověření kódem a uloží stav 2FA

#### Scenario: Přihlášení s 2FA
- **WHEN** má uživatel zapnuté 2FA a přihlásí se heslem
- **THEN** je vyžadován druhý faktor před zpřístupněním portálu

#### Scenario: Propojení s Google účtem
- **WHEN** přihlášený uživatel propojí Google účet
- **THEN** systém přidá Google jako login metodu pro stejný účet (bez vytvoření duplicity)

## MODIFIED Requirements

### Requirement: Admin logy pro operace s uživateli
Operace typu reset/měnění hesla SHALL vytvářet audit záznam (kdo, koho, kdy, typ akce) bez citlivých dat.

## REMOVED Requirements
Žádné.
