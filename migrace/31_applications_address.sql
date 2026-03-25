ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS address text;

