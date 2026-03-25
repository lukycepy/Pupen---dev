# Supabase migrace (produkce/staging)

Pokud aplikace hlásí chyby typu:
- `Could not find the table 'public.app_roles' in the schema cache`
- `Could not find the table 'public.password_resets' in the schema cache`

znamená to, že v cílové Supabase databázi ještě neběžely SQL migrace (nebo nebyl znovu načten schema cache API).

## Co udělat v Supabase

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
