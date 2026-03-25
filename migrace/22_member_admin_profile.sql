CREATE TABLE IF NOT EXISTS public.member_admin_profile (
  member_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  phone text,
  address text,
  date_of_birth date,
  application_received_at timestamptz,
  notes_internal text
);

ALTER TABLE public.member_admin_profile ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_admin_profile' AND policyname='member_admin_profile_superadmin_all'
  ) THEN
    CREATE POLICY member_admin_profile_superadmin_all
      ON public.member_admin_profile
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.can_manage_admins = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.can_manage_admins = true
        )
      );
  END IF;
END $$;

