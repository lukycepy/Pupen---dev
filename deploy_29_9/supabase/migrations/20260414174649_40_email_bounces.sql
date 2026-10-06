CREATE TABLE IF NOT EXISTS public.email_bounces (
  email text PRIMARY KEY,
  bounce_count int NOT NULL DEFAULT 0,
  last_bounced_at timestamptz NOT NULL DEFAULT now(),
  provider text,
  bounce_type text,
  reason text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_bounces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_bounces' AND policyname='email_bounces_admin_all'
  ) THEN
    CREATE POLICY email_bounces_admin_all
      ON public.email_bounces
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;

