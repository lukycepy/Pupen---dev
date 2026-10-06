# Vlastnictví účtů a evidence přístupů (minimální rámec)

Tento dokument shrnuje minimální požadavky na „vlastnictví“ a evidenci přístupů k infrastruktuře Pupen.org. Cílem je omezit závislost na jedné fyzické osobě a umožnit bezpečné předání.

## 1) Evidence přístupů (co evidovat)

- Supabase projekt (role, MFA, vlastníci projektu)
- VPS (SSH klíče, kdo má shell přístup, kdo je administrátor)
- Doména/DNS a perimeter (Cloudflare)
- E‑mail infrastruktura (SMTP/Mail server, DNS pro SPF/DKIM/DMARC)
- Password manager / vault, kde jsou uloženy technické přístupy

Evidence má obsahovat: jméno, roli, datum udělení přístupu, datum odebrání, poznámku k rozsahu.

## 2) Oddělení účtů na entitu spolku

Preferovaný stav:

- služby (Supabase, Cloudflare, VPS provider, mail infrastruktura) jsou vedené na účet organizace/spolku
- přístupy jednotlivců jsou uděleny jako „členové týmu“ s MFA a s minimálními právy

Minimální akceptovatelný stav (pokud nejde okamžitě převést vlastnictví):

- escrow/předávací proces: přístupové údaje jsou uloženy v organizovaném vaultu, ke kterému mají přístup min. 2 osoby
- definovaný postup, jak se přístup obnoví při nedostupnosti správce

## 3) Doporučené provozní minimum

- MFA povinně pro Supabase/Cloudflare a pro správu e‑mailů.
- SSH přístupy pouze přes klíče (bez sdílení hesel).
- Pravidelná revize přístupů (např. 1× za semestr).
- Tajné klíče držet v `.env`/server runtime a inventarizovat je bez hodnot (`secrets-inventory.md`).

## 4) Stav pro „Go/No‑Go“

Položka v checklistu je splněná, pokud existuje:

- aktuální evidence přístupů (kdo má přístup kam)
- potvrzené vlastnictví účtů na spolek, nebo formálně popsané escrow

