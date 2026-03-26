# Tasks
- [x] Task 1: Navrhnout a aplikovat jednotný UI kit napříč webem
  - [x] Definovat standardy: typografie, spacing, tlačítka, inputy, karty, badge, modaly, empty/error/loading
  - [x] Zjednotit copy patterny (nadpisy, popisky, CTA) a odstranit hardcoded řetězce mimo dictionaries
  - [x] Ověřit responsivitu a přístupnost (focus states, kontrast, klávesnice)

- [x] Task 2: Kompletní vizuální overhaul public webu (stránky i podstránky)
  - [x] Projít `app/[lang]/**` a sjednotit layouty, navigaci, hero/section styling, footer linky
  - [x] Sjednotit UI stavy a error handling u datových stránek (novinky, dokumenty, lost&found, sos)
  - [x] Opravit nejviditelnější UX hrany (copy, prázdné stavy, fallbacky, broken links)

- [x] Task 3: Kompletní vizuální overhaul adminu
  - [x] Sjednotit taby dashboardu: tabulky, search, filtry, CRUD modaly, confirm dialogy
  - [x] Zajistit konzistentní feedback (success/error), disabled stavy a loading indikátory
  - [x] Ověřit nejčastější flows (uploady, news, documents, users, sos, lost&found, newsletter)

- [x] Task 4: Kompletní vizuální overhaul členské sekce
  - [x] Sjednotit layout a sidebar (aktivní stav, mobil, scroll)
  - [x] Vyladit directory + mapu (čitelnost, filtr/search, prázdný stav)
  - [x] Vyladit dokumenty a profily (přístupová pravidla, empty/error, CTA)

- [x] Task 5: Funkční audit a opravy datových toků (kritické feature)
  - [x] Ověřit data dotazy a filtry (vyrocni-zpravy category filter, vybor role filter)
  - [x] Ověřit SOS offline cache + export endpoint (formaty, content-type, stabilita)
  - [x] Ověřit Lost&Found detail (API single item, propojení z listu, claim flow)
  - [x] Ověřit newsletter A/B subject + tracking variant + UTM
  - [x] Ověřit member directory map (address_meta validace, agregace, výkon)

- [x] Task 6: Konsolidace migrací do /migrace
  - [x] Identifikovat všechny DB změny přidané během implementace, které nejsou pokryté migracemi
  - [x] Zapsat chybějící migrace do `/migrace` (idempotentně) a doplnit případné ALTER pro existující tabulky
  - [x] Zajistit kompatibilitu s `scripts/db/migrate.js` a `scripts/db/drift-check.js`

- [x] Task 7: Final verifikace a regresní kontrola
  - [x] Spustit `npx tsc --noEmit` a `npm run build`
  - [x] Ruční smoke test kritických cest (cs/en): homepage hero, sos, lost-found detail, clen directory mapa, support form, vyrocni-zpravy, vybor, admin CRUD

# Task Dependencies
- Task 7 depends on Task 1, Task 2, Task 3, Task 4, Task 5, Task 6
