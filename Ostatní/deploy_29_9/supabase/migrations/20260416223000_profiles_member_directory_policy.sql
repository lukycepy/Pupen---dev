DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_member_directory'
  ) THEN
    CREATE POLICY profiles_select_member_directory
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (
        is_member = true
        AND is_blocked = false
        AND EXISTS (
          SELECT 1
          FROM public.profiles me
          WHERE me.id = auth.uid()
            AND (
              me.is_member = true
              OR me.is_admin = true
              OR me.can_manage_admins = true
              OR me.can_view_member_portal = true
              OR me.can_edit_member_portal = true
            )
        )
      );
  END IF;
END $$;
