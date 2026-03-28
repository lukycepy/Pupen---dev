# Přihlášky: e-maily, schvalování, PDF a UI Spec

## Why
Proces přihlášek má několik chyb a nedotažených částí (spam deliverability, chybějící e-mail uchazeči po schválení, chyba ON CONFLICT, nedotažený podpis předsedy, layout modalu závislý na zoomu, PDF bez požadovaných informací a designu).

## What Changes
- Upravit notifikační e-maily okolo přihlášek tak, aby byly doručitelné (nespadaly do spamu) a byly rozdělené podle příjemce (uchazeč vs. předseda/admin).
- Přidat do nastavení možnost volby, které e-maily dostávají upozornění o nové přihlášce.
- Opravit schvalování (chyba „there is no unique or exclusion constraint matching the ON CONFLICT specification“).
- Po schválení poslat uchazeči e-mail s PDF přihláškou a přihlašovacími údaji / aktivačním postupem.
- Opravit UI modalu detailu přihlášky (správné vykreslení bez závislosti na zoomu 90%).
- Opravit pole pro podpis předsedy (vstup, ukládání, náhled, použití uloženého podpisu).
- Upravit PDF přihlášky: název dokumentu, název souboru, doplnění GDPR souhlasu, poznámka o generování systémem, grafické vylepšení.

## Impact
- Affected specs: přihlášky, admin dashboard, e-mail systém, PDF export
- Affected code: API pro přihlášky, e-mail templaty/sending, DB migrace (constraints), UI admin modalu, PDF generator

## ADDED Requirements
### Requirement: Notifikace o nové přihlášce (nastavení příjemců)
Systém SHALL umožnit správcům nastavit, které e-mailové adresy dostávají upozornění o nové přihlášce.

#### Scenario: Admin nastaví příjemce notifikací
- **WHEN** admin uloží seznam e-mailů pro notifikace přihlášek
- **THEN** při další nové přihlášce se notifikace odešle pouze na tento seznam

### Requirement: Rozdělené e-maily podle role
Systém SHALL posílat odlišné e-maily:
- uchazeči (potvrzení přijetí / výsledek / přístup k účtu)
- předsedovi/adminům (notifikace a interní informace)

#### Scenario: Podání přihlášky
- **WHEN** uchazeč odešle přihlášku
- **THEN** uchazeč obdrží potvrzení o přijetí
- **AND** předseda/admin notifikace obdrží interní upozornění s odkazem do administrace

### Requirement: E-mail po schválení s PDF a přístupem
Systém SHALL po schválení přihlášky odeslat uchazeči e-mail obsahující:
- PDF přihlášku (příloha nebo bezpečný odkaz)
- instrukce k přihlášení/aktivaci účtu (podle toho, zda účet existoval)

#### Scenario: Schválení
- **WHEN** admin schválí přihlášku
- **THEN** uchazeč obdrží e-mail s PDF a přístupem

### Requirement: Doručitelnost e-mailů
Systém SHALL používat konzistentní transakční e-mail nastavení pro přihlášky:
- stabilní „From“ a „Reply-To“
- jednoduchý a validní HTML (bez rozbitých odkazů)
- textovou verzi (plaintext) nebo ekvivalentní obsah
- vhodné hlavičky (Message-ID, List-Id pro transakční notifikace, případně další běžné hlavičky)

## MODIFIED Requirements
### Requirement: Schvalování bez ON CONFLICT chyby
Schvalování SHALL fungovat bez DB chyby ON CONFLICT (tj. používaný `onConflict` musí odpovídat existující unique/exclusion constraint).

### Requirement: PDF přihláška (obsah + název + design)
PDF přihlášky SHALL:
- mít titul „PŘIHLÁŠKA DO STUDENTSKÉHO SPOLKU PUPEN, Z.S.“
- obsahovat GDPR souhlas (Ano/Ne podle dat v přihlášce)
- obsahovat větu „Tento dokument byl vygenerován systémem Pupen.“
- mít název souboru ve formátu `Příjmení-Jméno-PUPEN-YY.pdf` (bezpečné pro souborový systém; diakritika řešena konzistentně)
- mít zlepšený grafický design (hlavička, sekce, zarovnání, zalamování, podpisové bloky)

### Requirement: Modal detailu přihlášky
Modal detailu přihlášky SHALL být použitelný bez závislosti na zoomu prohlížeče (90% apod.) a bez ořezu klíčových částí.

## REMOVED Requirements
### Requirement: Notifikace přes obecný kontaktní e-mail
**Reason**: obecný kontaktní e-mail není vhodný pro transakční notifikace přihlášek a přispívá k doručitelnostním problémům a nekonzistenci.
**Migration**: zavést dedikované templaty a routing pro „application“ e-maily.

