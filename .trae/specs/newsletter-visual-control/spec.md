# Newsletter: vizuál a editace v Pupen Controlu Spec

## Why
Newsletter wrapper je zatím hardcoded a vizuálně jednoduchý; zároveň je potřeba dát možnost upravit vzhled a základní branding bez nasazení kódu.

## What Changes
- Zpřístupnit úpravu newsletter wrapperu v Pupen Controlu (admin) včetně náhledu.
- Přidat bezpečné proměnné (logo, barvy, footer text, sociální odkazy, preheader) a validaci výsledného HTML.
- Zlepšit deliverability newsletteru (konzistentní hlavičky, textový ekvivalent, List-Unsubscribe sekce v patičce).

## Impact
- Affected specs: admin dashboard (e-mail templaty), newsletter sending
- Affected code: e-mail templaty/render, admin UI pro templaty, případně DB override

## ADDED Requirements
### Requirement: Editovatelný newsletter wrapper
Systém SHALL umožnit adminovi upravit newsletter wrapper bez změny kódu.

#### Scenario: Admin změní šablonu
- **WHEN** admin upraví newsletter wrapper v Pupen Controlu
- **THEN** náhled i reálné rozesílky použijí nový wrapper

## MODIFIED Requirements
### Requirement: Newsletter obsahuje odhlášení a preferenční odkaz
Newsletter SHALL vždy obsahovat:
- odkaz na úpravu odběru
- odkaz na zrušení odběru

