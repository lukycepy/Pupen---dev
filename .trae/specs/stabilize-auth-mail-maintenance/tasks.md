# Tasks

- [ ] Task 1: Stabilizovat odesílání e‑mailů a diagnostiku
  - [ ] Reprodukovat chybu `ETIMEDOUT` a ověřit SMTP host/port/TLS režim podle nastavení
  - [ ] Doplnit bezpečné logování (bez hesel) + zlepšit admin „test e‑mailu“
  - [ ] Ověřit odeslání: test e‑mail, reset hesla, admin odeslání hesla

- [ ] Task 2: Upravit maintenance režim na „single maintenance page“
  - [ ] Změnit routing/middleware tak, aby při aktivní odstávce renderoval pouze odstávku (podobně jako custom 404)
  - [ ] V odstávce převést e‑mail/telefon v textu na klikatelné `mailto:` / `tel:`
  - [ ] Opravit vyhodnocování časového okna (start/end) tak, aby se po konci odstávky automaticky deaktivovala
  - [ ] Přidat rich editor pro obsah odstávky (CZ/EN) v admin controlu
  - [ ] Ověřit: veřejné stránky jsou nepřístupné během odstávky a po konci jsou dostupné; admin/login mohou být povolené dle požadavku

- [ ] Task 3: Přidat „Forgotten password“ pro uživatele
  - [ ] Přidat UI na login stránce + odeslání žádosti
  - [ ] Přidat stránku/flow pro nastavení nového hesla
  - [ ] Ověřit: neprozrazuje existenci účtu, funguje CZ/EN

- [ ] Task 4: Admin reset/změna hesla uživatele + audit
  - [ ] Přidat akce do admin „Uživatelé“: poslat reset, nastavit nové heslo, změnit heslo
  - [ ] Zajistit oprávnění (minimálně superadmin pro nastavení hesla) + audit log
  - [ ] Ověřit end‑to‑end: admin → změna hesla → uživatel se přihlásí

- [ ] Task 5: Pojmenované role a správa oprávnění
  - [ ] Navrhnout datový model (role + přiřazení uživatelům) a RLS/opravení přístupu
  - [ ] Přidat UI v admin controlu: vytvořit roli, upravit oprávnění, přiřadit roli uživateli
  - [ ] Napojit vyhodnocování oprávnění v aplikaci (bez regresí existujících boolean flagů)
  - [ ] Auditovat změny rolí/oprávnění v admin logu

- [ ] Task 6: 2FA / propojení s Google účtem
  - [ ] Přidat UI „Zabezpečení“ po přihlášení (zapnout/vypnout 2FA, propojit Google)
  - [ ] Implementovat 2FA enrolment + ověření při loginu
  - [ ] Implementovat Google OAuth linkování k existujícímu účtu (bez duplicit)
  - [ ] Ověřit CZ/EN a audit relevantních změn zabezpečení

- [ ] Task 5: Admin správa členské sekce z admin controlu
  - [ ] Navrhnout úložiště konfigurace (DB/config) a CRUD API
  - [ ] Přidat UI editor v admin controlu (viditelnost sekcí, texty, rychlé odkazy)
  - [ ] Aplikovat konfiguraci v členském portálu

- [ ] Task 6: Personalizace UI pro admin control a členský portál
  - [ ] Definovat per‑uživatelské preference (např. výchozí tab, onboarding, kompaktní režim)
  - [ ] Uložit preference (DB) + přidat UI nastavení
  - [ ] Ověřit: preference se aplikují po přihlášení

- [ ] Task 7: Dvojjazyčnost (admin + členský portál) pro dotčené části
  - [ ] Doplnit dictionary klíče a odstranit hardcoded texty pro nové/změněné UI
  - [ ] Ověřit CZ/EN na: login/forgot, admin (Uživatelé/Přihlášky), členský portál (nastavení/konfigurace)

# Task Dependencies
- Task 3 a Task 4 závisí na funkčním e‑mailingu (Task 1) nebo musí mít fallback (např. admin set password).
- Task 5 (role) vyžaduje rozhodnutí o napojení na existující permissions model.
- Task 6 (2FA/Google) vyžaduje rozhodnutí o auth integraci (Supabase Auth/OAuth/2FA).
- Task 5 (členská konfigurace) závisí na rozhodnutí o úložišti konfigurace (DB vs. config).
- Task 6 může běžet paralelně s Task 5, ale sdílí data model (preference/config).
