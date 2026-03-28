DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'newsletter_subscriptions'
      AND column_name = 'email'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (PARTITION BY lower(email) ORDER BY created_at DESC, id::text DESC) AS rn
      FROM public.newsletter_subscriptions
    )
    DELETE FROM public.newsletter_subscriptions n
    USING ranked r
    WHERE n.id = r.id
      AND r.rn > 1;

    UPDATE public.newsletter_subscriptions
    SET email = lower(email)
    WHERE email <> lower(email);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'newsletter_subscriptions_email_uq'
    ) THEN
      CREATE UNIQUE INDEX newsletter_subscriptions_email_uq
        ON public.newsletter_subscriptions (email);
    END IF;
  END IF;
END $$;

SELECT public.notify_schema_change();
