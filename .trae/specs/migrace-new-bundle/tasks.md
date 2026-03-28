# Tasks

- [ ] Identifikovat všechny migrace nutné pro všechny změny.
- [ ] Vytvořit `/migrace_new` a zkopírovat vybrané migrace v doporučeném pořadí.
- [ ] Přidat index (souborový seznam + krátký popis + pořadí aplikace).
- [ ] Ověřit idempotenci (IF NOT EXISTS) a volání `notify_schema_change()` u všech migrací v balíčku.

# Task Dependencies

- Index závisí na finálním seznamu migrací.

