# Kompletní Specifikace a Audit Funkcí Aplikace

## Proč (Why)
Aplikace "Pupen 4.0" momentálně obsahuje mnoho mockupů a nedokončených sekcí. Cílem je zprůchodnit veškeré klíčové funkční toky, zajistit, aby web "žil" (byl plně interaktivní, napojený na databázi a reálná data) a doručit masivní seznam požadavků od veřejného webu přes administraci, členský portál až po integrace a emailing.

## Co se mění (What Changes)
- **Veřejný web**: Zprovoznění a napojení Homepage (Novinky, Ankety, Odpočet, O nás, Newsletter, FAQ), Galerie, Kontaktů, SOS a legislativních stránek.
- **Autentizace a Uživatelské účty**: Registrace, Login, Reset hesla, gating podle rolí pro `/admin` a `/clen`.
- **Administrace**: Schvalování přihlášek (s podpisem), správa rolí a oprávnění, správa obsahu (FAQ, akce, novinky, dokumenty), audit logy a newsletter systém.
- **Členský portál**: Profily členů, GDPR export/smazání, interní zprávy (DM), výhody/slevy, účast na akcích (RSVP) a hlasování.
- **Přihláška a Adresy**: Napojení RÚIAN a Nominatim providerů s chybovým handlingem, validace GDPR a podpisů, generování PDF.
- **Emailing a Komunikace**: SMTP nastavení z databáze (nebo fallback z env), šablony pro transakční maily (přihlášky, refundy) a odesílání HTML newsletterů.
- **Infrastruktura a SEO**: i18n pro všechny texty, 404/500 chybové stránky, OpenGraph metadata, sitemap, robots.txt a bezpečnostní hlavičky.

## Dopad (Impact)
- Zasažené specifikace: Téměř celá platforma (frontend komponenty, Supabase databáze, RLS politiky, Edge funkce).
- Zasažený kód: Route handlers v `app/`, API v `app/api/`, komponenty, i18n dictionaries, a databázové schéma.

## PŘIDANÉ Požadavky (ADDED Requirements)
### Požadavek: Oživení veřejného webu
Systém MUSÍ zobrazovat reálná data z databáze místo statických mockupů pro sekce: Novinky, Ankety, FAQ, Akce, Galerie a Partneři.

### Požadavek: Komplexní administrace a role
Systém MUSÍ podporovat granulární oprávnění (RBAC), podle kterých se zobrazují moduly v administraci. Musí umožňovat plnohodnotné schvalování členských přihlášek včetně správy elektronických podpisů.

### Požadavek: Členská zóna a GDPR
Systém MUSÍ umožnit členům správu svého profilu, přístup k výhodám, stahování osobních údajů (GDPR export) a bezpečné mazání účtů.

## UPRAVENÉ Požadavky (MODIFIED Requirements)
### Požadavek: Emailing a SMTP
Dosavadní hardcoded nebo env-only SMTP nastavení bude přepsáno na konfiguraci primárně taženou z databáze s env fallbackem. Systém bude logovat odeslané e-maily a obsluhovat double opt-in pro newslettery.
