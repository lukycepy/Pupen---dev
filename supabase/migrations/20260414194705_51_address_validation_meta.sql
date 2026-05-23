ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_validated_at timestamptz;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS address_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS address_validated_at timestamptz;

