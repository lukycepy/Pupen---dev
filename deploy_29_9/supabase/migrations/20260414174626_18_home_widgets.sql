ALTER TABLE public.site_public_config
  ADD COLUMN IF NOT EXISTS home jsonb NOT NULL DEFAULT '{}'::jsonb;

