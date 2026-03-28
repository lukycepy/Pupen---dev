CREATE TABLE IF NOT EXISTS public.email_template_overrides (
  template_key text PRIMARY KEY,
  subject text NOT NULL DEFAULT '',
  html text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_overrides' AND policyname='email_template_overrides_admin_all'
  ) THEN
    CREATE POLICY email_template_overrides_admin_all
      ON public.email_template_overrides
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;

SELECT public.notify_schema_change();
