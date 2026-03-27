DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='newsletter_drafts') THEN
    EXECUTE 'ALTER TABLE public.newsletter_drafts ADD COLUMN IF NOT EXISTS ab_enabled boolean NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE public.newsletter_drafts ADD COLUMN IF NOT EXISTS subject_b text';
    EXECUTE 'ALTER TABLE public.newsletter_drafts ADD COLUMN IF NOT EXISTS ab_split integer NOT NULL DEFAULT 50';
  END IF;
END $$;
