ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS doi_token_hash text,
  ADD COLUMN IF NOT EXISTS doi_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS doi_confirmed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'newsletter_subscriptions_doi_token_hash_uq'
  ) THEN
    CREATE UNIQUE INDEX newsletter_subscriptions_doi_token_hash_uq
      ON public.newsletter_subscriptions (doi_token_hash)
      WHERE doi_token_hash IS NOT NULL;
  END IF;
END $$;

SELECT public.notify_schema_change();

