-- Add feature flags to site_public_config

ALTER TABLE public.site_public_config
ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Trigger to invalidate schema cache
DROP TRIGGER IF EXISTS tr_site_public_config_schema_change ON public.site_public_config;
CREATE TRIGGER tr_site_public_config_schema_change
  AFTER CREATE OR ALTER OR DROP ON public.site_public_config
  FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();
