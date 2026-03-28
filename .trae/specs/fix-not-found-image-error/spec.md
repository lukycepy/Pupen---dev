# Oprava runtime chyby Image v not-found Spec

## Why
Stránka 404 (`app/not-found.tsx`) padá v runtime chybou „Failed to construct 'Image'…“, což rozbíjí UX a může ovlivnit SEO i fallback navigaci.

## What Changes
- Opravit import a použití `Image` komponenty tak, aby se nepoužíval globální DOM constructor `Image`.
- Přidat jednoduchý regresní check (build + ruční otevření 404) pro ověření.

## Impact
- Affected specs: not-found UX
- Affected code: `app/not-found.tsx`

## MODIFIED Requirements
### Requirement: 404 stránka nesmí padat
404 stránka SHALL renderovat bez runtime chyb v prohlížeči.

#### Scenario: Uživateli se otevře neexistující URL
- **WHEN** uživatel navštíví neexistující stránku
- **THEN** zobrazí se not-found UI
- **AND** v konzoli nejsou runtime chyby

