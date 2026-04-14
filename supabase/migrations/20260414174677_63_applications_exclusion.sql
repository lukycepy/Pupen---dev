DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='excluded_at') THEN
    ALTER TABLE public.applications
      ADD COLUMN excluded_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='excluded_by_email') THEN
    ALTER TABLE public.applications
      ADD COLUMN excluded_by_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='excluded_reason') THEN
    ALTER TABLE public.applications
      ADD COLUMN excluded_reason text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS applications_excluded_at_idx ON public.applications(excluded_at);

