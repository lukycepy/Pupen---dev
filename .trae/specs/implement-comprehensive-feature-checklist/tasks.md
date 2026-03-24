# Tasks

- [ ] Task 1: Veřejný web - Homepage a základní obsah (Public Web Core)
  - [ ] Napojit Homepage hero sekci ("Rosteme společně", fallback obrázky, rotace).
  - [ ] Zprovoznit rychlé karty (komunita, akce, hrdost) a odpočet na nejbližší akci.
  - [ ] Implementovat sekce O nás teaser, Novinky (2 poslední), Ankety (vč. hlasování a anti-spam).
  - [ ] Napojit Instagram feed grid a zprovoznit Newsletter signup (validace, API přesměrování).
  - [ ] Implementovat stránky: FAQ (filtrování), Kontakty (mailto, honeypot, form), Ztráty a nálezy, SOS.

- [ ] Task 2: Veřejný web - Legislativa, SEO a Infrastruktura
  - [ ] Zprovoznit Cookies policy, Privacy policy, Terms of service.
  - [ ] Vygenerovat dynamický Robots.txt a Sitemap.xml.
  - [ ] Vyladit chybové stránky 404 (not-found) a 500 (error.tsx).
  - [ ] Nastavit OpenGraph metadata, jazykový switch cs/en, canonical odkazy a i18n pro všechny texty.

- [ ] Task 3: Autentizace a Uživatelské účty
  - [ ] Implementovat/zkontrolovat Login page (Email/heslo).
  - [ ] Zprovoznit Forgot password flow a Reset password page.
  - [ ] Nasadit Gating podle oprávnění pro `/clen` a `/admin`.
  - [ ] Zajistit kompatibilitu Invite/recovery a ochranu API přes Bearer token (nebo Supabase session).

- [ ] Task 4: Administrace - Core a Přihlášky
  - [ ] Vytvořit Admin dashboard s dynamickým sidebarem podle modulů/oprávnění.
  - [ ] Zprovoznit modul "Schvalování přihlášek" (Detail v modalu, podpis žadatele, uložený/nový podpis předsedy).
  - [ ] Implementovat logiku schválení/zamítnutí (metadata, důvod, automatické generování přístupů po přijetí).
  - [ ] Oživit RÚIAN / Nominatim adresní našeptávač s error handlingem a přepínáním v admin configu.

- [ ] Task 5: Administrace - Role a Oprávnění (RBAC)
  - [ ] Správa rolí: barva (color_hex), badge s kontrastem, přiřazení podle e-mailu.
  - [ ] Definovat klíče oprávnění (can_view, can_edit) a aplikovat je na UI a API.
  - [ ] Přidat "Nemáte oprávnění" page s CTA "Zpět do aplikace".

- [ ] Task 6: Administrace - Obsah a Emailing
  - [ ] Zprovoznit správu obsahu: FAQ, Events, Documents, Gallery, Partners.
  - [ ] Implementovat Admin Inbox (čtení, mazání, přehled).
  - [ ] Zprovoznit Admin Newsletter: seznam odběratelů, mazání, filtrace, odeslání HTML kampaně.
  - [ ] Nastavit SMTP (DB `email_settings` s fallbackem na env, TLS rejectUnauthorized) a vytvořit testovací endpoint.
  - [ ] Nasadit e-mailové šablony (Welcome, Refund, Invoice, Ticket, Newsletter, Contact).

- [ ] Task 7: Členský portál (`/clen`) a Osobní data
  - [ ] Zprovoznit Sidebar linky a celkový profil člena (Zobrazení ročníku, oboru, e-mailů, stavu účtu, role badge).
  - [ ] Implementovat GDPR export tlačítko a smazání účtu s rate limitingem na API.
  - [ ] Zprovoznit přehled výhod, slev, akcí (s RSVP) a systém interních zpráv (DM).

- [ ] Task 8: Infrastruktura databáze a bezpečnost
  - [ ] Opravit chybějící sloupce v DB (např. `profiles.can_edit_member_portal`, `events.description`) a schema cache.
  - [ ] Doplnit RLS politiky pro public (čtení) a admin (zápis) tabulky.
  - [ ] Zprovoznit logování do `error_logs`, `admin_logs` a audit akcí.

- [ ] Task 9: UI/UX a Optimalizace (Nice to have / Polish)
  - [ ] Nasadit skeleton loading stavy, empty states, toast notifikace a confirm modaly pro destruktivní akce.
  - [ ] Zprovoznit lazy-load obrázků, CDN optimalizaci (WebP/AVIF), accessibility (focus rings, aria labels).
  - [ ] Implementovat pokročilé admin funkce (Paginace, vyhledávání, filtry, sort, bulk akce).

# Task Dependencies
- Task 3 a Task 5 (Autentizace a Role) musí být stabilní před dokončením Task 4 (Admin Core) a Task 7 (Členský portál).
- Task 8 (DB schéma) má nejvyšší prioritu, protože na něm závisí načítání dat pro všechny ostatní moduly. Měl by běžet jako první.
- Task 6 (Emailing) vyžaduje hotové SMTP nastavení (DB/env).