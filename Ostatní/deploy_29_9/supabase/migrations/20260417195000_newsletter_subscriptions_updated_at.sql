ALTER TABLE public.newsletter_subscriptions
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.newsletter_subscriptions
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_newsletter_subscriptions') THEN
    CREATE TRIGGER trg_set_updated_at_newsletter_subscriptions
      BEFORE UPDATE ON public.newsletter_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

