ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

SELECT public.notify_schema_change();
