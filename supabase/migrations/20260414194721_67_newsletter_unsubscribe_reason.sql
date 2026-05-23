ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_reason text,
  ADD COLUMN IF NOT EXISTS unsubscribe_reason_detail text,
  ADD COLUMN IF NOT EXISTS unsubscribe_source text,
  ADD COLUMN IF NOT EXISTS unsubscribe_campaign_id text,
  ADD COLUMN IF NOT EXISTS unsubscribe_variant text;

SELECT public.notify_schema_change();

