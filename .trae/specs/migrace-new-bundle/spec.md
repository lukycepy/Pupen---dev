# Balíček migrací do /migrace_new Spec

## Why
Změny v aplikaci vyžadují databázové migrace a je potřeba mít jasný, snadno aplikovatelný „balíček“ migrací pro deploy (bez dohledávání po repozitáři).

## What Changes
- Vytvořit složku `/migrace_new` a zkopírovat do ní všechny nové/nezbytné migrace pro aktuální změny.
- Přidat stručný index (pořadí + účel) a ověřit, že migrace jsou idempotentní (`IF NOT EXISTS`) a volají `notify_schema_change()`.
- **BREAKING**: žádné; jde o organizační zlepšení nasazení.

## Impact
- Affected specs: DB schema a deploy proces
- Affected code: pouze migrační soubory a jejich provozní aplikace

## ADDED Requirements
### Requirement: Migration bundle
Systém SHALL mít `/migrace_new` jako aktuální balíček migrací potřebných pro nové releasy.

#### Scenario: Nasazení
- **WHEN** se nasazuje nová verze
- **THEN** admin aplikuje migrace v `/migrace_new` v uvedeném pořadí
- **AND** aplikace běží bez schema-cache chyb

## MODIFIED Requirements
### Requirement: Migrace jsou dohledatelné
Nové migrace SHALL být evidované v balíčku a nesmí se „ztrácet“ mezi staršími soubory.

