# Tasks
- [x] Opravit schvalování přihlášek bez ON CONFLICT chyby.
- [x] Přidat nastavení příjemců notifikací o nové přihlášce.
- [x] Rozdělit e-maily: uchazeč vs. předseda/admin, a zlepšit doručitelnost.
- [x] Poslat uchazeči po schválení e-mail s PDF a přístupem k účtu.
- [x] Opravit podpis předsedy v admin modalu (UI, ukládání, použití uloženého podpisu).
- [x] Opravit modal detailu přihlášky (layout bez závislosti na zoomu).
- [x] Předělat PDF přihlášky dle požadavků (název, filename, GDPR, poznámka, design).
- [x] Přidat validace a smoke testy pro celý flow přihlášky.

# Task Dependencies
- Odesílání e-mailů po schválení závisí na spolehlivém generování PDF.
- Nastavení příjemců notifikací závisí na perzistenci v DB.
