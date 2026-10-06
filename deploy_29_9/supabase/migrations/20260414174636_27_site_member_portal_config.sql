ALTER TABLE public.site_public_config
  ADD COLUMN IF NOT EXISTS member_portal jsonb NOT NULL DEFAULT '{}'::jsonb;

