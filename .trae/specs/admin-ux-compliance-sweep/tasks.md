# Tasks

- [x] Task 1: QR kód konfigurátor (logo/text/styly)
  - [x] Doplnit UI ovládací prvky (text, logo upload, preset styly, export)
  - [x] Zajistit čitelnost QR (limity velikosti loga, tichá zóna)
  - [x] Přidat testovací scénáře (ruční + minimální unit helpery pokud existují)

- [x] Task 2: Pročištění logů pro superadmina
  - [x] Přidat server endpoint pro purge (403 pro nesuperadmina)
  - [x] Přidat UI akci v Logy (potvrzovací modal, rozsah: starší než N dní)
  - [x] Zapsat audit log o promazání (kdo/kdy/rozsah)

- [x] Task 3: Sken přihlášky u člena + ruční doplnění
  - [x] Navrhnout Storage bucket/prefix a DB sloupce/tabulku pro přílohy
  - [x] Přidat upload do profilu člena v adminu (PDF/JPG/PNG)
  - [x] Přidat formulář pro ruční doplnění dat + audit log

- [x] Task 4: Kompletní UI redesign (admin + členská sekce)
  - [x] Definovat a použít společné UI komponenty (header/panel/form/modals/empty/error)
  - [x] Sjednotit nejdůležitější taby (Akce, Novinky, Uživatelé, Logy, Nastavení)
  - [x] Sjednotit členskou sekci (navigace, formuláře, stavy)

- [x] Task 5: Legislativa ToS/Privacy/Cookies
  - [x] Zmapovat aktuální stránky a odstranění zdvojeného obsahu
  - [x] Implementovat strukturu pro texty CZ/EN (bez právních tvrzení bez dodaného textu)
  - [x] Přidat možnost snadné aktualizace obsahu (preferovaně přes config/DB nebo soubory)

- [x] Task 6: Lokalizace + zdvojené texty
  - [x] Najít konkrétní zdvojení a opravit render (CZ/EN)
  - [x] Doplnit chybějící klíče do dictionaries a odstranit nepoužité

- [x] Task 7: Úklid dočasných souborů + redundantního/rozbitého kódu
  - [x] Audit nepoužívaných souborů a mrtvých částí
  - [x] Bezpečně odstranit/refaktorovat se zachováním chování
  - [x] Ověřit build a klíčové flows

# Task Dependencies
- Task 4 závisí na výsledcích Task 6 (sjednocení textů a klíčů).
- Task 3 může běžet paralelně s Task 1/2, ale vyžaduje DB/Storage rozhodnutí.
- Task 7 běží až po stabilizaci UI (Task 4/6), aby se nemazalo něco potřebného.
