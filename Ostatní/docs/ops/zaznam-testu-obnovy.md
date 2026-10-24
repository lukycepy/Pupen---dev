# Záznam běhů záloh a testů obnovy

Tento soubor slouží jako evidence pro „prokázání“ zálohování a obnovy (pro interní potřeby a pro případné ověření v rámci pilotu).

## 1) Běhy záloh (operativní evidence)

| Datum | Typ | Výsledek | Artefakt (název) | Retence | Poznámka |
|---|---|---|---|---|---|
| 2026-10-24 | DB | OK (exit 0) | `db_prod_20261024_162715.dump` (765 352 B) | dle politiky v `offsite-zalohy-plan.md` | `backup-db.mjs --env prod`; `verify-backup.mjs` potvrdil SHA-256 shodu (`5fb3fde7…`); `pg_restore --list` = 1375 objektů / 149 tabulek s daty. |
|  | Storage |  |  |  |  |

## 2) Test obnovy (min. 1× měsíčně)

| Datum | Cíl | Záloha použitá | Postup (stručně) | Výsledek | Zjištění / opatření |
|---|---|---|---|---|---|
| 2026-10-24 | lokální scratch PostgreSQL 18 (port 55432) – náhrada za staging | `db_prod_20261024_162715.dump` | `initdb --auth=trust` → `restore-db.mjs --env local --from <dump> --yes` (`DATABASE_URL_LOCAL`) | OK – 110 tabulek v `public`, `profiles` = 1 řádek, `user_login_aliases.relrowsecurity = t`, `schema_migrations` = 125 | `pg_restore` hlásí 290 varování `role "authenticated" does not exist` – jde o očekávaný artefakt obnovy Supabase dumpu do čistého PostgreSQL (chybí Supabase role/schéma, data i RLS se obnoví). Na skutečném stagingu (Supabase) se varování neobjeví. |
|  | staging |  |  |  |  |

## 3) Poznámky

- Cílem testu není „dokonalý“ disaster recovery dokument, ale prokazatelný minimální proces.
- Pokud se objeví problém, doplnit stručné opatření a datum, kdy bylo ověřeno.