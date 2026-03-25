CREATE TABLE IF NOT EXISTS public.sos_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  category text,
  phone text,
  email text,
  url text,
  note text,
  is_public boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.sos_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sos_contacts'
      AND policyname = 'sos_select_public'
  ) THEN
    CREATE POLICY sos_select_public
      ON public.sos_contacts
      FOR SELECT
      TO anon, authenticated
      USING (is_public = true);
  END IF;
END $$;

