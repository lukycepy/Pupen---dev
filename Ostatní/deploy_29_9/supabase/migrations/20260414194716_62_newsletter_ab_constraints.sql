DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter' AND column_name='ab_split') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_ab_split_range') THEN
      EXECUTE 'ALTER TABLE public.newsletter ADD CONSTRAINT newsletter_ab_split_range CHECK (ab_split >= 10 AND ab_split <= 90)';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter_drafts' AND column_name='ab_split') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_drafts_ab_split_range') THEN
      EXECUTE 'ALTER TABLE public.newsletter_drafts ADD CONSTRAINT newsletter_drafts_ab_split_range CHECK (ab_split >= 10 AND ab_split <= 90)';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter_events' AND column_name='variant') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_events_variant_check') THEN
      EXECUTE 'ALTER TABLE public.newsletter_events ADD CONSTRAINT newsletter_events_variant_check CHECK (variant IS NULL OR variant IN (''a'', ''b''))';
    END IF;
  END IF;
END $$;
