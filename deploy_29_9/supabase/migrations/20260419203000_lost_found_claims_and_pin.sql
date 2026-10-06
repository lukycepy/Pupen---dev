ALTER TABLE public.lost_found_items
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision;

CREATE TABLE IF NOT EXISTS public.lost_found_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  item_id uuid NOT NULL REFERENCES public.lost_found_items(id) ON DELETE CASCADE,
  name text,
  email text,
  message text,
  is_anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'claimed'
);

ALTER TABLE public.lost_found_claims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='lost_found_claims' AND policyname='lost_found_claims_public_insert'
  ) THEN
    CREATE POLICY lost_found_claims_public_insert
      ON public.lost_found_claims
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='lost_found_claims' AND policyname='lost_found_claims_admin_all'
  ) THEN
    CREATE POLICY lost_found_claims_admin_all
      ON public.lost_found_claims
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND p.can_manage_admins = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND p.can_manage_admins = true
        )
      );
  END IF;
END $$;

SELECT public.notify_schema_change();

