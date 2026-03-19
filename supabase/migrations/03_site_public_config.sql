CREATE TABLE IF NOT EXISTS public.site_public_config (
  id int PRIMARY KEY DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_title_cs text,
  maintenance_body_cs text,
  maintenance_title_en text,
  maintenance_body_en text,
  pages jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO public.site_public_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_public_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_public_config'
      AND policyname = 'site_public_config_select_all'
  ) THEN
    CREATE POLICY site_public_config_select_all
      ON public.site_public_config
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

