ALTER TABLE public.site_public_config
  ADD COLUMN IF NOT EXISTS maintenance_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_end_at timestamptz;

