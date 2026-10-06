DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lost_found_items'
      AND policyname = 'lost_found_admin_write'
  ) THEN
    CREATE POLICY lost_found_admin_write
      ON public.lost_found_items
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sos_contacts'
      AND policyname = 'sos_admin_write'
  ) THEN
    CREATE POLICY sos_admin_write
      ON public.sos_contacts
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

