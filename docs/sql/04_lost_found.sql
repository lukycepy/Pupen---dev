CREATE TABLE IF NOT EXISTS public.lost_found_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  category text,
  location text,
  contact text,
  status text NOT NULL DEFAULT 'open',
  is_public boolean NOT NULL DEFAULT true,
  photo_url text
);

ALTER TABLE public.lost_found_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lost_found_items'
      AND policyname = 'lost_found_select_public'
  ) THEN
    CREATE POLICY lost_found_select_public
      ON public.lost_found_items
      FOR SELECT
      TO anon, authenticated
      USING (is_public = true);
  END IF;
END $$;

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

