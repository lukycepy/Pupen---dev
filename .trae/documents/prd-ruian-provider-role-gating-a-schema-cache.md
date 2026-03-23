# Page Design Spec (desktop-first)

## Globální styly (platí pro všechny stránky)

* Layout: CSS Grid pro shell (sidebar + obsah), Flexbox pro řádky/toolbar; mezery 8/12/16/24.

* Typografie: 14–16px základ, H1 28–32, H2 20–24, H3 16–18; konzistentní line-height.

* Barvy: neutrální pozadí (světlé), primární akce výrazná; success/warn/error s jasným kontrastem.

* Komponenty: jednotné Button (primary/secondary/ghost), Input, Select, Textarea, Modal, Drawer, Tabs, Table, EmptyState, Skeleton.

* Interakce: hover + focus ring, disabled stavy, potvrzení pro destruktivní akce, toast pro výsledek.

***

## 1) Přihlášení

* Meta: title „Přihlášení | Pupen“, description „Přihlášení do Pupen Control a Členské sekce“, OG title.

* Page structure: centrovaná karta (max 420px), vlevo/vpravo volitelný brand panel (na desktopu).

* Sekce a komponenty:

  * Header: logo + krátké vysvětlení.

  * Form: email, heslo / alternativně „poslat přístup“ (pokud je v produktu), CTA „Přihlásit“.

  * Secondary actions: „Zapomenutý přístup“, „Přejít na přihlášku do členství“.

  * Error handling: inline validace (zod), globální alert pro autentizační chyby.

* Responsivita: na mobilu full-width karta, spacing zmenšit, sekundární odkazy pod CTA.

***

## 2) Pupen Control (Admin dashboard)

* Meta: title „Pupen Control“, description „Administrace obsahu a provozu“.

* Layout: Grid 280px sidebar + fluid content; sticky topbar v content části.

* Page structure: „app shell“ (Sidebar + Topbar + Workspace).

* Sekce a komponenty:

  * Sidebar (levý):

    * Záhlaví: název „Pupen Control“ + přepínač jazyka (pokud relevantní).

    * Navigace dle skupin (collapsible): Obsah / Komunita / Provoz / Finance / Governance / Systém.

    * Viditelnost položek: jen moduly, na které máš oprávnění.

  * Topbar (vpravo nahoře):

    * Globální hledání + command palette (Ctrl/⌘+K): hledá modul i položky (dle možností).

    * „Rychlé akce“ (např. vytvořit položku) kontextově podle modulu.

    * Profil menu: jméno, úprava profilu (modal), odhlášení.

  * Workspace (obsah):

    * Standard „List → Detail“: vlevo tabulka/seznam s filtrem, vpravo detail (panel) nebo detail pod seznamem.

    * Akce: primární (Uložit), sekundární (Zrušit), destruktivní (Smazat) s potvrzením.

    * Stavy: skeleton při načítání, empty state s CTA, inline errors.

  * Konzistence modulů:

    * Stejná struktura: Nadpis modulu, krátký popis, toolbar (filtr/sort/export pokud existuje), seznam, detail.

***

## 3) Členská sekce (Portál člena)

* Meta: title „Členská sekce“, description „Členský portál a výhody“.

* Layout: jednodušší shell než admin (Topbar + volitelný levý mini-sidebar), primárně karty.

* Page structure: přehledové sekce nad sebou.

* Sekce a komponenty:

  * Header: pozdrav + status členství (badge) + rychlé odkazy.

  * „Výhody a obsah“: grid karet (Slevy, Akce, Dokumenty…) s jasnými popisy.

  * Profil: základní údaje, tlačítko „Upravit“ (modal nebo samostatný panel).

  * Notifikace: prostor pro systémová sdělení (např. změna stavu členství).

* Responsivita: karty do 1 sloupce, akce v sticky spodní liště jen pokud je potřeba.

***

## 4) Přihláška do členství

* Meta: title „Přihláška do členství“, description „Žádost o členství v Pupen“.

* Layout: dvousloupec (na desktopu) – vlevo formulář, vpravo „co bude dál“.

* Sekce a komponenty:

  * Form: logické bloky (Osobní údaje, Souhlasy, Doplňující info), průběžné ukládání není vyžadované.

  * Potvrzení: po odeslání zobrazit summary + stav (např. „Odesláno“).

  * Stav žádosti: jednoduchá timeline (Odesláno → Zpracování → Schváleno/Zamítnuto).

* Přístupnost: jasné popisky, error summary nahoře, klávesová navigace.

