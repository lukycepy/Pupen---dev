DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_ab_split_range') THEN
    ALTER TABLE public.newsletter
      ADD CONSTRAINT newsletter_ab_split_range CHECK (ab_split >= 10 AND ab_split <= 90);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_drafts_ab_split_range') THEN
    ALTER TABLE public.newsletter_drafts
      ADD CONSTRAINT newsletter_drafts_ab_split_range CHECK (ab_split >= 10 AND ab_split <= 90);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_events_variant_check') THEN
    ALTER TABLE public.newsletter_events
      ADD CONSTRAINT newsletter_events_variant_check CHECK (variant IS NULL OR variant IN ('a', 'b'));
  END IF;
END $$;

