ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{all}'::text[];

UPDATE public.newsletter_subscriptions
SET categories = '{all}'::text[]
WHERE categories IS NULL;

SELECT public.notify_schema_change();
