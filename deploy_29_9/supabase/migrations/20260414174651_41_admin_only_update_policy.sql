DO $$
DECLARE
  r record;
  pol_update_name text;
  pol_delete_name text;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND c.relname NOT LIKE 'pg_%'
  LOOP
    pol_update_name := r.table_name || '_admin_update';
    pol_delete_name := r.table_name || '_admin_delete';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = r.table_name
        AND p.policyname = pol_update_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin())',
        pol_update_name,
        r.table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = r.table_name
        AND p.policyname = pol_delete_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_superadmin())',
        pol_delete_name,
        r.table_name
      );
    END IF;
  END LOOP;
END $$;

