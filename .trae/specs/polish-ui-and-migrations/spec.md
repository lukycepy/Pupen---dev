# Kompletní UI/UX overhaul + konsolidace migrací Spec

## Why
Funkce byly rychle implementované, ale UI je místy „MVP“, admin/členská sekce nejsou graficky sjednocené a některé DB změny existují bez jasně sepsaných migrací. Cílem je kompletní vizuální a funkční overhaul tak, aby byl web použitelný a konzistentní napříč všemi stránkami a podstránkami (cs/en), včetně adminu a členské sekce.

## What Changes
- Kompletně sjednotit UI/UX napříč webem (public + admin + member): layout, typografie, spacing, komponenty, CTA, stavy.
- Zpřesnit UX copy a překlady (cs/en) tak, aby nebyly hardcoded texty mimo dictionaries.
- Opravit funkční nedostatky (data dotazy, validace, chybové stavy, fallbacky, cache, routing).
- Zajistit, že všechny DB změny odpovídají migracím v `/migrace` a jsou aplikovatelné přes migration pipeline.
- **BREAKING**: žádné plánované (pokud se objeví, bude explicitně popsáno v PRACOVNÍCH poznámkách v tasks.md).

## Impact
- Affected specs:
  - Public: všechny stránky a podstránky v `app/[lang]/**` (včetně nově přidaných).
  - Admin: dashboard (taby, CRUD, search, modaly, toasty), systémové nástroje.
  - Member: `/clen` (taby, directory + mapa, dokumenty, profily, UX flows).
  - Email/newsletter: A/B subject + tracking, UTM, admin compose UX.
  - Offline/SOS a Lost&Found: export, QR, offline cache, detail flow.
- Affected code: layouty, shared UI komponenty, dictionary struktura, admin/member UI, API routy pro supporting funkce, `/migrace` SQL + db scripts.

## ADDED Requirements
### Requirement: Web musí být použitelný a konzistentní
Systém SHALL mít jednotný vizuální jazyk (UI kit) a konzistentní chování komponent napříč public/admin/member částí.

#### Scenario: Konzistentní UI stavy
- **WHEN** uživatel otevře libovolnou stránku s daty (public/admin/member)
- **THEN** vidí konzistentní loading/empty/error stavy a jasnou akci pro pokračování.

### Requirement: Admin a členská sekce musí být „produkčně“ ergonomické
Systém SHALL umožnit běžné admin operace a členské flow bez vizuálních glitchů a bez nutnosti „hádat“, co se stalo.

#### Scenario: CRUD feedback
- **WHEN** admin uloží/změní/smaže záznam
- **THEN** UI ukáže výsledek (success/error), udrží konzistenci seznamu a nevznikne rozbitý state.

#### Scenario: Offline a error fallback
- **WHEN** selže načtení `/api/sos`
- **THEN** stránka zobrazí poslední cache a jasnou informaci o stáří dat.

### Requirement: Migrace musí pokrýt DB změny
Systém SHALL mít všechny DB změny potřebné pro nové funkce sepsané jako SQL migrace v `/migrace` a migrace musí být idempotentní (`IF NOT EXISTS` / bezpečné ALTER).

#### Scenario: Aplikace migrací
- **WHEN** se spustí `npm run db:migrate`
- **THEN** se migrace aplikují bez chyby na čisté DB i na DB, kde už část změn existuje.

## MODIFIED Requirements
### Requirement: Internationalization pro UI texty
UI texty pro stránky, podstránky a modaly SHALL být řízené přes dictionaries (cs/en) bez hardcoded řetězců v komponentách (mimo technické/URL/identifikátory).

## REMOVED Requirements
Žádné.
