ALTER TABLE public.newsletter
  ADD COLUMN IF NOT EXISTS ab_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.newsletter
  ADD COLUMN IF NOT EXISTS subject_a text;

ALTER TABLE public.newsletter
  ADD COLUMN IF NOT EXISTS subject_b text;

ALTER TABLE public.newsletter
  ADD COLUMN IF NOT EXISTS ab_split integer NOT NULL DEFAULT 50;

ALTER TABLE public.newsletter_events
  ADD COLUMN IF NOT EXISTS variant text;

