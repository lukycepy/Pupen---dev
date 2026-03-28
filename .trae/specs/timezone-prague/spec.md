# Časová zóna: jednotně Europe/Prague Spec

## Why
Časy a datumy se zobrazují/počítají nekonzistentně (UTC vs. lokální čas), což vede k chybným časům u akcí, logů, schůzí, odpočtů a e-mailů.

## What Changes
- Zavést jednotné pravidlo pro práci s časem:
  - ukládání do DB jako `timestamptz` (UTC) beze změn
  - zobrazování a exporty vždy v časové zóně `Europe/Prague`
- Přidat sdílené utility pro formátování datumu/času v Praze a používat je napříč UI i serverem.
- Zajistit, že „now“ (aktuální čas) pro serverové operace, které tvoří texty (PDF, e-maily), používá `Europe/Prague` při formátování.

## Impact
- Affected specs: akce, přihlášky, e-maily, PDF export, admin logy, countdowny
- Affected code: date formatting v UI i API vrstvách

## MODIFIED Requirements
### Requirement: Zobrazení času v Praze
Systém SHALL zobrazovat všechny uživatelské časové údaje v časové zóně `Europe/Prague`.

#### Scenario: Zobrazení času akce
- **WHEN** uživatel vidí datum/čas akce
- **THEN** čas odpovídá Praze (včetně DST)

