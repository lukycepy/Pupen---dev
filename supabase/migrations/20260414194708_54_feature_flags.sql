-- Add feature flags to site_public_config

ALTER TABLE public.site_public_config
ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;
