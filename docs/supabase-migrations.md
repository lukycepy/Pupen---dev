# Supabase migrace (produkce/staging)

Pokud aplikace hlásí chyby typu:
- `Could not find the table 'public.app_roles' in the schema cache`
- `Could not find the table 'public.password_resets' in the schema cache`

znamená to, že v cílové Supabase databázi ještě neběžely SQL migrace (nebo nebyl znovu načten schema cache API).

## Doporučený postup (repo pipeline)

Repo obsahuje skripty, které umí migrace aplikovat přímo do cílové DB a zároveň hlídat drift.

- Aplikace migrací:
  - `npm run db:migrate` (bere `DATABASE_URL`)
  - `npm run db:migrate:staging` (bere `DATABASE_URL_STAGING`, fallback `DATABASE_URL`)
  - `npm run db:migrate:prod` (bere `DATABASE_URL_PROD`, fallback `DATABASE_URL`)
- Drift check (jestli DB odpovídá migracím v repu):
  - `npm run db:drift-check` / `:staging` / `:prod`
- RLS check (konzistence RLS + policy na public tabulkách):
  - `npm run db:rls-check` / `:staging` / `:prod`

Skripty si v cílové databázi vytvoří tabulku `public.schema_migrations` pro evidenci aplikovaných souborů.

## Co udělat v Supabase (ručně)

1. Otevřít Supabase Dashboard → SQL Editor.
2. Spustit obsah příslušných migrací z repozitáře:
   - `migrace/26_app_roles.sql`
   - `migrace/25_password_resets.sql` (pokud je v projektu používaná tokenová varianta resetu)
   - `migrace/33_admin_schema_cache_tools.sql` (volitelné: umožní reload schema cache přes admin endpoint)
3. Po aplikaci změn obnovit schema cache:
   - Dashboard → Settings → API → Restart API
   - nebo v SQL Editoru:
     - `select pg_notify('pgrst', 'reload schema');`

## Poznámky

- Vercel deploy sám o sobě migrace do Supabase neaplikuje.
- Pokud nechcete používat role (`app_roles`), stačí je v adminu ignorovat nebo migraci doplnit později; ostatní části portálu mohou fungovat i bez toho.
