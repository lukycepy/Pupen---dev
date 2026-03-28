# Overhaul UI vrstev (modaly bez glitchů) Spec

## Why
Aktuální UI používá více různých patternů pro overlaye/modaly, které se občas „řežou“ přes `overflow/transform`, mají nekonzistentní z-index a chybí jim jednotné chování (focus, ESC, scroll lock).

## What Changes
- Zavést jednotný systém „top-layer“ komponent pro:
  - Modal/Dialog
  - Drawer/Sidebar overlay
  - Toast/Notifications container
  - Progress/Loading bary
- Sjednotit z-index vrstvy a pravidla pro overlaye (jediný zdroj pravdy).
- Sjednotit UX a a11y:
  - focus trap + návrat focusu na původní prvek
  - ESC zavírá nejvyšší modal
  - click na backdrop zavírá (pokud není zakázáno)
  - scroll lock pro `body` při otevřeném modalu
- **BREAKING**: odstranit ad-hoc overlay markup na stránkách a nahradit ho jednotnými komponentami.

## Impact
- Affected specs: navigace, admin dashboard, člen portal, veřejné stránky
- Affected code: UI komponenty a všechny stránky s overlaye (modaly, drawer, lightbox, command palette, cookie, toasty)

## ADDED Requirements
### Requirement: Top-layer systém
Systém SHALL vykreslovat overlaye vždy mimo hierarchii stránky tak, aby nebyly ovlivněné `transform/overflow` rodičů.

#### Scenario: Modal otevření
- **WHEN** uživatel otevře modal
- **THEN** modal se vykreslí v `document.body`, překryje stránku a obsah stránky pod ním nescrolluje
- **AND** focus se přesune do modalu

#### Scenario: Modal zavření
- **WHEN** uživatel zavře modal (ESC / křížek / backdrop)
- **THEN** modal zmizí a focus se vrátí na původní spouštěcí prvek

### Requirement: Vrstvení (z-index)
Systém SHALL používat jednotnou škálu vrstev:
- Base content
- Sticky (např. navbar)
- Overlay (drawer/backdrop)
- Modal/Dialog
- Toast
- System bars (route/progress)

## MODIFIED Requirements
### Requirement: Existující modaly
Všechny existující modaly/drawery SHALL používat jednotnou komponentu (Modal/Dialog nebo Drawer) a dodržovat top-layer pravidla.

## REMOVED Requirements
### Requirement: Ad-hoc overlay markup
**Reason**: způsobuje nekonzistenci a glitchování (řezání, špatný z-index, chybějící focus a scroll lock).
**Migration**: nahradit všechny bloky `fixed inset-0 ...` jednotnými komponentami.

